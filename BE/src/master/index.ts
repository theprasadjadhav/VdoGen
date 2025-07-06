import express from "express";
import {  clerkMiddleware, verifyToken } from "@clerk/express";
import type { JobData, VideoSpecsType } from "../types/types";
import { JobQueue, prismaClient, redis, storage, bucketName, logger } from "../util/config";
import { authMiddleware, validateInputs } from "./middlewares";
import { videoStatusEnum } from "../util/enums";
import { getSignedUrl, rewriteManifest, sendError } from "./functions";
import cors from "cors"
import rateLimit from 'express-rate-limit'
import type { Request, Response, NextFunction } from 'express';
import path from "path";

const app = express()

app.use(express.json());

const corsOrigin = process.env.CORS_ORIGIN || '*';
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 100, // 100 requests 
    standardHeaders: true,
    legacyHeaders: false,
})


app.use(cors({ origin: corsOrigin }));
app.use(limiter);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname,"public",'index.html'))
})

app.get("/video/:id/manifest", async (req, res) => {
    try {
        const id = req.params.id
        logger.info(`[Manifest] Request for video manifest. id=${id}`);
        if (!id || isNaN(Number(id))) {
            logger.info(`[Manifest] Invalid or missing video ID: ${id}`);
            sendError(res, 400, "The provided video ID is invalid or missing");
            return;
        }

        const token = req.query.token
        if (!token || typeof token !== 'string' || token.trim() === '') {
            logger.info(`[Manifest] Missing or invalid token for video id=${id}`);
            sendError(res, 401, "A valid token is required to access this resource");
            return;
        }

        try {
            const authorizedParty =  process.env.AUTHORIZED_PARTY || "http://localhost:5173"
            await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY,
                authorizedParties: [authorizedParty],
            })
            logger.info(`[Manifest] Token verified for video id=${id}`);
        } catch (tokenError) {
            logger.info(`[Manifest] Token verification failed for video id=${id}`);
            sendError(res, 401, "The provided token is invalid or expired");
            return;
        }

        const manifestPath = `videos/video_${id}/playlist.m3u8`
        const manifestFile = storage.bucket(bucketName).file(manifestPath)
        const [exists] = await manifestFile.exists()
        
        if (!exists) {
            logger.info(`[Manifest] Manifest file does not exist for video id=${id}`);
            sendError(res, 404, "The requested video manifest does not exist");
            return;
        }

        try {
            const [manifest] = await manifestFile.download()
            const manifestContent = manifest.toString('utf-8')
            const keyUrl = await getSignedUrl(`video_${id}/enc.key`, 5)
            const updatedManifest = manifestContent.replace(
                /#EXT-X-KEY:METHOD=AES-128,URI=".*?",IV=(0x[0-9a-fA-F]+)/,
                `#EXT-X-KEY:METHOD=AES-128,URI="${keyUrl}",IV=$1`
            );
            const modifiedManifest = await rewriteManifest(updatedManifest, id)

            logger.info(`[Manifest] Successfully served manifest for video id=${id}`);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.status(200).send(modifiedManifest);
        } catch (manifestError) {
            logger.error(`[Manifest] Failed to process manifest for video id=${id}`);
            sendError(res, 500, "Failed to process the video manifest");
            return;
        }
    } catch (error) {
        logger.error(`[Manifest] Unexpected error for video id=${req.params.id}`);
        sendError(res, 500, "An unexpected error occurred while processing your request");
        return;
    }
})

app.use(clerkMiddleware())
app.use(authMiddleware as express.RequestHandler)

app.get("/content/:conversationId", async (req, res) => {
    try {
        const userId = req.auth.userId || ""
        const conversationId = req.params.conversationId
        logger.info(`[Content] Fetching content for userId=${userId}, conversationId=${conversationId}`);

        if (!conversationId || typeof conversationId !== 'string' || conversationId.trim() === "") {
            logger.info(`[Content] Invalid conversationId: ${conversationId}`);
            sendError(res, 400, "Invalid conversationId");
            return;
        }

        const content = await prismaClient.video.findMany({
            where: { userId, conversationId },
            select: {
                id: true,
                prompt: true,
                conversationId: true,
                isError: true,
                Error: true,
                status: true,
                userId: true,
                createdAt: true
            },
            orderBy: { createdAt: "asc" }
        })

        if (!content || content.length === 0) {
            logger.info(`[Content] No content found for userId=${userId}, conversationId=${conversationId}`);
            sendError(res, 404, "No content found for this conversation/user");
            return;
        }

        logger.info(`[Content] Found ${content.length} items for userId=${userId}, conversationId=${conversationId}`);
        res.status(200).json(content)
    } catch (error) {
        logger.error(`[Content] Failed to fetch content for userId=${req.auth.userId}, conversationId=${req.params.conversationId}`);
        sendError(res, 500, "Failed to fetch content");
        return;
    }
})

app.get("/history", async (req, res): Promise<void> => {
    try {
        const userId = req.auth.userId || ""
        logger.info(`[History] Fetching history for userId=${userId}`);
        const history = await prismaClient.conversation.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" }
        })
        logger.info(`[History] Found ${history.length} conversations for userId=${userId}`);
        res.status(200).json(history)
    } catch (error) {
        logger.error(`[History] Failed to fetch history for userId=${req.auth.userId}`);
        sendError(res, 500, "Failed to fetch history");
        return;
    }
})

app.post("/gen", validateInputs, async (req, res) => {
    let conversationId = req.body.conversationId
    const prompt = String(req.body.prompt)
    const specs: VideoSpecsType = req.body.specs
    logger.info(`[Gen] Video generation requested. userId=${req.auth.userId}, conversationId=${conversationId}`);
    try {
        const video = await prismaClient.$transaction(async (tx) => {
            if(!conversationId || conversationId === "new"){
                const newConversation = await tx.conversation.create({
                    data: {firstPrompt:prompt,userId:req.auth.userId || ""}
                })
                logger.info(`[Gen] New conversation created. id=${newConversation.id}, userId=${req.auth.userId}`);
                conversationId = newConversation.id
            }

            const video = await tx.video.create({
                data: {
                    conversationId,
                    prompt,
                    duration: specs.duration,
                    fps: specs.fps,
                    aspectRatio: specs.aspectRatio,
                    resolution: specs.resolution,
                    userId: req.auth.userId || ""
                }
            })
            logger.info(`[Gen] New video record created. id=${video.id}, conversationId=${conversationId}, userId=${req.auth.userId}`);
            return video
        })

        const jobData: JobData = {
            id: video.id,
            conversationId,
            prompt,
            specs,
            userId:video.userId
        }

        try {
            await JobQueue.add(jobData)
            await redis.set(`video:${video.id}`, videoStatusEnum.INITIATED, "EX", 3600)
            logger.info(`[Gen] Job queued and Redis status set. videoId=${video.id}`);
        } catch (redisError) {
            logger.error(`[Gen] Failed to queue job or set Redis status. videoId=${video.id}`);
            sendError(res, 500, "Failed to queue video generation job");
            return;
        }

        logger.info(`[Gen] Video generation request processed successfully. videoId=${video.id}`);
        res.status(200).json({
            id: video.id,
            conversationId: video.conversationId,
            status: video.status,
            prompt: video.prompt,
            duration: video.duration,
            fps: video.fps,
            aspectRatio: video.aspectRatio,
            resolution: video.resolution,
            userId: video.userId,
            createdAt: video.createdAt,
        })
    } catch (error) {
        logger.error(`[Gen] Failed to generate video. userId=${req.auth.userId}, conversationId=${conversationId}`);
        sendError(res, 500, "Failed to generate video");
        return;
    }
})

app.get("/status", async (req, res)=> {
    const id = req.query.id
    logger.info(`[Status] Status check requested for video id=${id}`);
    if (!id || isNaN(Number(id)) || !Number.isInteger(Number(id))) {
        logger.info(`[Status] Invalid input for status check: id=${id}`);
        sendError(res, 400, "Bad Request: Invalid input");
        return;
    }

    const parsedId = parseInt(id as string)
    let status = null;
    let miss = false;

    try {
        status = await redis.get(`video:${parsedId}`)
        logger.info(`[Status] Redis status for video id=${parsedId}: ${status}`);
    } catch (redisError) {
        logger.error(`[Status] Redis error for video id=${parsedId}`);
        status = null;
    }

    if (status) {
        if (status === videoStatusEnum.ERROR) {
            try {
                const newId = await redis.get(`newVideo:${parsedId}`)
                logger.info(`[Status] Video id=${parsedId} errored, checking for new video id: ${newId}`);
                if (!newId) {
                    miss = true
                } else {
                    res.status(200).json({
                        id: newId,
                        status: videoStatusEnum.PROCESSING
                    })
                    return
                }
            } catch (redisError) {
                logger.error(`[Status] Redis error while fetching newVideo for id=${parsedId}`);
                miss = true
            }
        } else {
            res.status(200).json({
                id: parsedId,
                status
            })
            return
        }
    }

    if (miss || !status) {
        try {
            const video = await prismaClient.video.findFirst({ where: { id: parsedId } })
            logger.info(`[Status] DB lookup for video id=${parsedId}: ${video ? 'found' : 'not found'}`);
            if (!video) {
                sendError(res, 400, "Bad Request: Invalid input");
                return;
            }
            if (video.status === videoStatusEnum.ERROR) {
                const newVideo = await prismaClient.video.findFirst({ 
                    where: { conversationId: video.conversationId }, 
                    orderBy: { createdAt: "desc" } 
                })
                logger.info(`[Status] Video id=${parsedId} errored, found new video id=${newVideo?.id}`);
                if (!newVideo) {
                    sendError(res, 400, "something went wrong try again later");
                    return;
                }
                res.status(200).json({
                    id: newVideo.id,
                    status: videoStatusEnum.PROCESSING
                })
                return
            }
            res.status(200).json({
                id: parsedId,
                status: video.status
            })
            return
        } catch (dbError) {
            logger.error(`[Status] DB error while fetching status for video id=${parsedId}`);
            sendError(res, 500, "Internal server error, unable to fetch status");
            return;
        }
    }
})

app.use((req, res) => {
    logger.info(`[404] Not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, message: "Not found" });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(process.env.PORT || 8080,()=>{
    logger.info("master started")
})