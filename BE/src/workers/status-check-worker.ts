

import { videoStatusEnum } from "../types";
import type { VideoSpecsType } from "../types";
import { k8s, kc, k8sBatchClient, JobQueue, redis, prismaClient, logger, namespace } from "../util/config";


const informer = k8s.makeInformer(
    kc,
    `/apis/batch/v1/namespaces/${namespace}/jobs`,
    () =>
        k8sBatchClient.listNamespacedJob({
            namespace: namespace,
            labelSelector: "app=script-runner",
        })
);


async function processJob(job: k8s.V1Job) {
    const labels = job.metadata?.labels;

    if (!labels) return;

    const videoId = labels["videoId"];
    const retry = labels["retry"]

    if (!videoId) {
        logger.warn({
            msg: "videoId label missing",
            job: job.metadata?.name,
        });
        return;
    }

    const cachedStatus = await redis.get(`video:${videoId}`);
    const terminal = [videoStatusEnum.COMPLETE, videoStatusEnum.FAILED, videoStatusEnum.ERROR];

    if (terminal.includes(cachedStatus as any)) {
        logger.info({
            msg: `Job for videoId ${videoId} is in terminal state: ${cachedStatus}. Skipping further processing.`,
            videoId,
            cachedStatus,
        });
        return;
    }

    const completed = job.status?.conditions?.some(c => c.type === "Complete" && c.status === "True");

    const failed = job.status?.conditions?.some(c => c.type === "Failed" && c.status === "True");


    if (completed) {

        await prismaClient.video.update({
            where: { id: Number(videoId) },
            data: {
                status: videoStatusEnum.COMPLETE,
            },
        });

        await redis.set(
            `video:${videoId}`,
            videoStatusEnum.COMPLETE,
            "EX",
            3600
        );

        return;
    }

    if (failed) {

        if (Number(retry) < 2) {

            // lock per video-retry so that each will be processed only once
            const acquired = await redis.set(`retry-lock:${videoId}:${retry}`, "1", "EX", 3600 + 60, "NX");   // expiry is till TTL of job + margin. it will make sure look is there till last event for that job is triggered
            if (!acquired) {
                logger.warn({
                    msg: `Retry lock not acquired for videoId: ${videoId}, retry attempt: ${retry}. Another process may be handling the retry.`,
                    videoId,
                    retry
                });
                return;
            }
            logger.info({
                msg: `Retry lock acquired for videoId: ${videoId}, retry attempt: ${retry}. Proceeding to retry video job.`,
                videoId,
                retry
            });


            const video = await prismaClient.video.findFirst({
                where: { id: Number(videoId) }
            });

            if (video) {
                await JobQueue.add('video-job', {
                    id: video.id,
                    conversationId: video.conversationId,
                    prompt: video.prompt,
                    specs: {
                        resolution: video.resolution as VideoSpecsType["resolution"],
                        aspectRatio: video.aspectRatio as VideoSpecsType["aspectRatio"],
                        duration: video.duration as VideoSpecsType["duration"],
                        fps: video.fps as VideoSpecsType["fps"]
                    },
                    userId: video.userId,
                    retry: Number(retry) + 1,
                    isFailed: true
                },
                    { priority: 1 });

                logger.info({
                    msg: "Failed job added back to the queue for retry",
                    id: videoId
                })

            } else {
                await redis.set(
                    `video:${videoId}`,
                    videoStatusEnum.ERROR,
                    "EX",
                    3600
                );
                await prismaClient.video.update({
                    where: { id: Number(videoId) },
                    data: {
                        status: videoStatusEnum.ERROR,
                        isError: true,
                    },
                });
                logger.error({
                    msg: "Unable to retry: video not found",
                    id: videoId
                })
            }
        } else {
            await prismaClient.video.update({
                where: { id: Number(videoId) },
                data: {
                    status: videoStatusEnum.FAILED,
                    isError: true,
                },
            });

            await redis.set(
                `video:${videoId}`,
                videoStatusEnum.FAILED,
                "EX",
                3600
            );
            logger.info({
                msg: "Failed to create video after 3 retries",
                id: videoId
            })
        }
    }
}


informer.on("add", processJob);
informer.on("update", processJob);

informer.on("delete", job => {
    logger.info({
        msg: "Job deleted",
        job: job.metadata?.name,
    });
});

let reconnecting = false;

async function reconnect(reason: string) {
    if (reconnecting) return;          // prevent double-reconnect if both handlers fire
    reconnecting = true;

    logger.warn({ msg: "[StatusWorker] Watch closed, reconnecting in 5s", reason });
    await new Promise(r => setTimeout(r, 5000));

    try {
        await informer.start();
        logger.info({ msg: "[StatusWorker] Informer reconnected" });
    } catch (err) {
        // reconnect itself failed — NOW it's unrecoverable
        process.exit(1);
    } finally {
        reconnecting = false;
    }
}

informer.on("error", (err: Error) => reconnect(err.message));

await informer.start();

logger.info({
    msg: "[StatusWorker] Job informer started",
    namespace: namespace,
});

process.on('unhandledRejection', (reason) => {
    reconnect(reason instanceof Error ? reason.message : String(reason));
});

process.on('uncaughtException', (error: Error) => {
    logger.error({ msg: "[StatusWorker] Uncaught exception, exiting", error: error.message });
    process.exit(1);
});

process.on('SIGTERM', async () => {
    await informer.stop();
    await prismaClient.$disconnect();
    await redis.quit();
    process.exit(0);
});