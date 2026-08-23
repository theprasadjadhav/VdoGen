import { Router } from "express";
import { logger, prismaClient, redis, JobQueue } from "../../util/config";
import { validateInputs } from "../middlewares";
import { videoStatusEnum } from "../../types";
import { getManifestFile, sendError } from "../functions";
import type { JobData, VideoSpecsType } from "../../types";
import { spawn } from "child_process";
import { videoGenLimiter } from "../rateLimiters";


const videoRouter = Router()

const FREE_USER_VIDEO_LIMIT = 3;

// Thrown inside the /create transaction when the atomic free-tier slot
// reservation affects 0 rows (limit already reached).
class FreeLimitReachedError extends Error {
    constructor() {
        super("Free user video limit reached");
    }
}

videoRouter.get("/:id/manifest", async (req, res) => {
    const type = req.query.type
    const id = req.params.id
    const userId = req.user?.id;

    if (!type || !(type === "preview" || type === "edit")) {
        logger.info({
            msg: "[Manifest] Invalid or missing type for video manifest request",
            id,
            providedType: type
        });
        sendError(res, 400, "The type is invalid or missing");
        return;
    }

    try {
        if (!id || isNaN(Number(id))) {
            logger.info({
                msg: "[Manifest] Invalid or missing video ID",
                id
            });
            sendError(res, 400, "The provided video ID is invalid or missing");
            return;
        }
       
        const video = await prismaClient.video.findUnique({
            where: { id: Number(id), userId },
        });
        if (!video) {
            logger.info({
                msg: "[Manifest] Video does not belong to user or not found",
                id,
                userId,
            });
            sendError(res, 403, "Forbidden: You do not have access to this video");
            return;
        }


        try {
            const expiry = type === "edit" ? 3000 : 60;

            const modifiedManifest = await getManifestFile(String(id), expiry);
            logger.info({
                msg: "[Manifest] Manifest served successfully",
                id,
                type,
                success: !!modifiedManifest
            });

            if (!modifiedManifest) {
                sendError(res, 500, "Failed to process the video manifest");
                return;
            }

            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            res.status(200).send(modifiedManifest);
        } catch (manifestError) {
            logger.error({
                msg: "[Manifest] Failed to process manifest",
                id,
                error: manifestError instanceof Error ? manifestError.message : manifestError
            });
            if (manifestError instanceof Error && manifestError.message.includes("does not exist")) {
                return sendError(res, 404, "Requested video does not exist");
            }
            return sendError(res, 500, "Failed to process the video manifest");
        }
    } catch (error) {
        logger.error({
            msg: "[Manifest] Unexpected error while processing request",
            id: req.params.id,
            error: error instanceof Error ? error.message : error
        });
        sendError(res, 500, "An unexpected error occurred while processing your request");
        return;
    }
});


videoRouter.post("/create", videoGenLimiter, validateInputs, async (req, res) => {
    let conversationId = req.body.conversationId
    const prompt = String(req.body.prompt)
    const specs: VideoSpecsType = req.body.specs
    const userId = req.user?.id!

    let user = await prismaClient.user.findUnique({
        where: { id: userId },
        omit: {
            updatedAt: true,
            createdAt: true
        }
    });

    if (!user) {
        logger.info({
            msg: "Video generation failed: User not found",
            userId: userId,
            method: req.method,
            url: req.originalUrl
        });
        return sendError(res, 404, "User not found");
    }

    const isPrime = user.primeExpiry && new Date(user.primeExpiry) > new Date();;

    try {

        if (!isPrime) {
            // Fast-path UX check only; the authoritative gate is the atomic
            // reservation inside the transaction below.
            logger.info({
                msg: "Checking free user usage limits",
                userId: userId
            });

            if (user.useCount >= FREE_USER_VIDEO_LIMIT) {
                logger.warn({
                    msg: "Free user limit reached",
                    userId: userId,
                    usageCount: user.useCount
                });
                return sendError(res, 403, `You have reached the limit of ${FREE_USER_VIDEO_LIMIT} video generations for free users. Please upgrade your plan to continue.`);

            }
        }

        const video = await prismaClient.$transaction(async (tx) => {
            if (!isPrime) {
                // Atomically reserve a free slot: single UPDATE with a predicate on
                // useCount. Concurrent requests serialize on the user row lock and the
                // predicate is re-evaluated after the lock is released, so the cap can
                // never be exceeded. The increment is undone automatically if any other
                // statement in this transaction fails.
                const reserved = await tx.$executeRaw`
                    UPDATE "User"
                    SET "useCount" = "useCount" + 1
                    WHERE "id" = ${userId} AND "useCount" < ${FREE_USER_VIDEO_LIMIT}`;

                if (reserved === 0) {
                    throw new FreeLimitReachedError();
                }
            }

            if (!conversationId || conversationId === "new") {
                const newConversation = await tx.conversation.create({
                    data: { firstPrompt: prompt, userId }
                })
                logger.info({
                    msg: "New conversation created",
                    conversationId: newConversation.id,
                    userId: userId,
                    firstPrompt: prompt
                });
                conversationId = newConversation.id
            }


            const video = await tx.video.create({
                data: {
                    conversationId,
                    prompt: prompt,
                    duration: specs.duration,
                    fps: specs.fps,
                    aspectRatio: specs.aspectRatio,
                    resolution: specs.resolution,
                    userId
                },
                select: {
                    id: true,
                    conversationId: true,
                    status: true,
                    prompt: true,
                    duration: true,
                    fps: true,
                    aspectRatio: true,
                    resolution: true,
                    createdAt: true,
                }
            })

            logger.info({
                msg: "New video record created",
                videoId: video.id,
                conversationId: conversationId,
                userId: userId,
                specs: specs
            });

            return video
        })

        const jobData: JobData = { id: video.id, conversationId, prompt, specs, userId, retry: 0 }

        try {
            await JobQueue.add("video-job", jobData)
        } catch (queueError) {
            // Queueing happens after the DB transaction has committed, so the rows
            // are NOT rolled back automatically. Keep the rows (video/conversation
            // stay in DB in a failed state) and surface the failure to the client.
            // Free-slot refund handling is planned separately.
            logger.error({
                msg: "Failed to queue video job; marking video failed",
                videoId: video.id,
                conversationId,
                userId: userId,
                error: queueError instanceof Error ? queueError.message : queueError
            });
            try {
                await prismaClient.video.update({
                    where: { id: video.id },
                    data: {
                        status: videoStatusEnum.FAILED,
                        isError: true,
                        Error: `Failed to queue video generation: ${queueError instanceof Error ? queueError.message : queueError}`
                    }
                });
            } catch (markFailedError) {
                logger.error({
                    msg: "Failed to mark video as failed after queue failure",
                    videoId: video.id,
                    error: markFailedError instanceof Error ? markFailedError.message : markFailedError
                });
            }
            return sendError(res, 500, "Failed to generate video");
        }

        try {
            await redis.set(`video:${userId}:${video.id}`, videoStatusEnum.INITIATED, "EX", 3600)
        } catch (redisError) {
            // Non-fatal: the /video/status route falls back to the DB when Redis misses.
            logger.warn({
                msg: "Failed to set initial video status in Redis",
                videoId: video.id,
                error: redisError instanceof Error ? redisError.message : redisError
            });
        }
        logger.info({
            msg: "Job queued and Redis status set",
            videoId: video.id,
            conversationId: conversationId,
            userId: userId
        });


        logger.info({
            msg: "Video generation request processed successfully",
            videoId: video.id,
            conversationId: conversationId,
            userId: userId
        });

        // The free-tier useCount was already incremented atomically inside the
        // transaction, so only reflect it in the response.
        const responseUser = isPrime ? user : { ...user, useCount: user.useCount + 1 };

        res.status(200).json({ success: true, message: "Video generation started", video, user: responseUser })
    } catch (error) {
        if (error instanceof FreeLimitReachedError) {
            logger.warn({
                msg: "Free user limit reached (atomic gate)",
                userId: userId,
                usageCount: user?.useCount
            });
            return sendError(res, 403, `You have reached the limit of ${FREE_USER_VIDEO_LIMIT} video generations for free users. Please upgrade your plan to continue.`);
        }

        logger.error({
            msg: "Failed to generate video",
            userId: userId,
            conversationId: conversationId,
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
        });
        sendError(res, 500, "Failed to generate video");
        return;
    }
})

videoRouter.get("/status", async (req, res) => {
    const id = req.query.id
    const userId = req.user?.id
    if (!id || isNaN(Number(id)) || !Number.isInteger(Number(id))) {
        logger.info({
            msg: "[Status] Invalid input for status check",
            id: id
        });
        sendError(res, 400, "Bad Request: Invalid input");
        return;
    }

    const parsedId = parseInt(id as string)
    let status = null;

    try {
        status = await redis.get(`video:${userId}:${parsedId}`)
        logger.info({
            msg: "[Status] Redis status fetch",
            id: parsedId,
            status: status
        });
    } catch (redisError) {
        logger.error({
            msg: "[Status] Redis error for video",
            id: parsedId,
            error: redisError instanceof Error ? redisError.message : redisError,
            stack: redisError instanceof Error ? redisError.stack : undefined
        });
        status = null;
    }

    if (status) {
        logger.info({
            msg: "[Status] Returning video status from Redis",
            id: parsedId,
            status: status
        });
        res.status(200).json({ success: true, message: "Video status fetched", id: parsedId, status })
    } else {
        try {
            const video = await prismaClient.video.findFirst({ where: { id: parsedId, userId } })
            logger.info({
                msg: "[Status] DB lookup for video",
                id: parsedId,
                found: !!video
            });
            if (!video) {
                logger.info({
                    msg: "[Status] No video found in DB for id",
                    id: parsedId
                });
                res.status(200).json({ success: true, message: "Video status fetched", id: parsedId, status: "Video Not Found" })
                return;
            }

            logger.info({
                msg: "[Status] Returning video status from DB",
                id: parsedId,
                status: video.status
            });
            res.status(200).json({ success: true, message: "Video status fetched", id: parsedId, status: video.status })
        } catch (dbError) {
            logger.error({
                msg: "[Status] DB error while fetching status for video",
                id: parsedId,
                error: dbError instanceof Error ? dbError.message : dbError,
                stack: dbError instanceof Error ? dbError.stack : undefined
            });
            sendError(res, 500, "Internal server error, unable to fetch status");
            return;
        }
    }
})

videoRouter.get("/download", async (req, res) => {
    try {
        const videoId = req.query.videoId
        const userId = req.user?.id!

        if (!videoId || isNaN(Number(videoId))) {
            logger.info({
                msg: "[Download] Invalid input for download",
                videoId: videoId,
                userId: userId
            });
            sendError(res, 400, "Bad Request: Invalid input")
            return
        }

        const video = await prismaClient.video.findFirst({
            where: { id: Number(videoId), userId: userId }
        })
        logger.info({
            msg: "[Download] DB lookup for video",
            videoId: videoId,
            userId: userId,
            found: !!video
        });

        if (!video) {
            logger.info({
                msg: "[Download] No video found in DB for download",
                videoId: videoId,
                userId: userId
            });
            sendError(res, 400, "Bad Request: Invalid input")
            return
        }

        const manifestFile = await getManifestFile(String(videoId), 10)
        logger.info({
            msg: "[Download] Manifest file fetch",
            videoId: videoId,
            userId: userId,
            manifestFound: !!manifestFile
        });

        if (!manifestFile) {
            logger.error({
                msg: "[Download] Manifest file not found",
                videoId: videoId,
                userId: userId
            });
            sendError(res, 500, "Internal server error")
            return
        }

        logger.info({
            msg: "[Download] Starting ffmpeg stream for download",
            videoId: videoId,
            userId: userId
        });

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');

        const ffmpeg = spawn("ffmpeg", [
            "-protocol_whitelist", "pipe,file,http,https,tcp,tls,crypto",
            "-f", "hls",
            "-i", "pipe:0",
            "-c", "copy",
            "-movflags", "frag_keyframe+empty_moov",
            "-f", "mp4",
            "pipe:1"
        ]);

        ffmpeg.stdin.write(manifestFile);
        ffmpeg.stdin.end();

        ffmpeg.stdout.pipe(res);

        ffmpeg.stderr.on("error", (error) => {
            logger.error({
                msg: "[Download] ffmpeg stderr error",
                videoId: videoId,
                userId: userId,
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined
            });
        });

        ffmpeg.on("close", (code) => {
            if (code === 0) {
                logger.info({
                    msg: "[Download] ffmpeg stream ended successfully",
                    videoId: videoId,
                    userId: userId
                });
            } else {
                logger.error({
                    msg: "[Download] ffmpeg process exited with non-zero code",
                    videoId: videoId,
                    userId: userId,
                    exitCode: code
                });
            }
        });
    } catch (error) {
        logger.error({
            msg: "[Download] Unexpected error",
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
        });
        sendError(res, 500, "Internal server error")
        return;
    }
})

export default videoRouter