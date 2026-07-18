

import { videoStatusEnum } from "../types";
import type { VideoSpecsType } from "../types";
import { k8s, kc, k8sBatchClient, JobQueue, redis, prismaClient, logger, namespace } from "../util/config";


// logger.info({
//     msg: "Kubernetes job status check worker process started",
//     environment: process.env.NODE_ENV,
//     pid: process.pid
// })

// async function statusJobProcessor(statusJob: Job): Promise<void> {
//     const { id, conversationId, k8sJobName, prompt, specs, userId, retry } = statusJob.data

//     try {
//         const job = await k8sBatchClient.readNamespacedJobStatus({
//             name: k8sJobName,
//             namespace: 'vdogen'
//         });
//         const status = job.status;
//         logger.info({
//             msg: "[StatusWorker] Checked k8s job status",
//             k8sJobName,
//             id,
//             status,
//         });
//         // Handle successful jobs
//         if (status?.succeeded) {
//             await prismaClient.video.update({
//                 where: { id },
//                 data: { status: videoStatusEnum.COMPLETE }
//             });
//             await redis.set(`video:${id}`, videoStatusEnum.COMPLETE, 'EX', 3600);
//             logger.info({
//                 msg: "[StatusWorker] Set COMPLETE status in db and redis",
//                 id,
//                 k8sJobName
//             });
//             return;
//         }
//         // Handle failed jobs
//         if (status?.failed) {
//             logger.error({
//                 msg: "[StatusWorker] Job failed",
//                 id,
//                 k8sJobName,
//             });

//             if (retry < 2) {
//                 await JobQueue.add('video-job', { id, conversationId, prompt, specs, userId, retry: retry + 1, isFailed: true }, { priority: 1 });
//             } else {
//                 await prismaClient.video.update({
//                     where: { id },
//                     data: { isError: true, Error: "An error occurred during script execution and was not resolved after 3 retries.", status: videoStatusEnum.ERROR }
//                 });
//                 await redis.set(`video:${id}`, videoStatusEnum.ERROR, 'EX', 3600);
//             }
//             return
//         }

//         const statusJobData: StatusJobData = { k8sJobName, id, conversationId, prompt, specs, userId, retry };
//         logger.info({
//             msg: "[StatusWorker] Re-added status job to queue with delay",
//             k8sJobName,
//             id,
//             delay: 20000
//         });
//         await StatusQueue.add("status-job", statusJobData, { delay: 20_000 });
//         return

//     } catch (error) {
//         const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
//         logger.error({
//             msg: "[StatusWorker] Exception in status check",
//             id,
//             k8sJobName,
//             error: errorMsg
//         });
//         await prismaClient.video.update({
//             where: { id },
//             data: { isError: true, Error: errorMsg, status: videoStatusEnum.FAILED }
//         });
//         await redis.set(`video:${id}`, videoStatusEnum.FAILED, 'EX', 3600);
//     }
// }

// try {
//     await redis.ping();
//     logger.info({
//         msg: "Redis connection verified",
//         queueName: 'Status-Queue'
//     });
// } catch (error) {
//     logger.error({
//         msg: "Failed to connect to Redis",
//         error: error instanceof Error ? error.message : error,
//         stack: error instanceof Error ? error.stack : undefined
//     });
//     process.exit(1);
// }

// const statusJobWorker = new Worker<StatusJobData, void>(
//     "Status-Queue",
//     statusJobProcessor,
//     {
//         connection: redisConfig,
//         concurrency: 10,
//         removeOnComplete: {
//             count: 1,
//             age: 3600
//         },
//         removeOnFail: {
//             count: 1,
//             age: 3600
//         }
//     }
// )

// logger.info({
//     msg: "Initializing worker",
//     queueName: 'Status-Queue',
// });

// statusJobWorker.on("ready", () => {
//     logger.info({
//         msg: "[StatusWorker] Worker is ready and listening for jobs",
//         queueName: 'Job-Queue'
//     });
// });

// statusJobWorker.on("active", (job) => {
//     logger.info({
//         msg: "[StatusWorker] Job started processing",
//         id: job?.id,
//         videoId: job?.data?.id
//     });
// });

// statusJobWorker.on("completed", (job) => {
//     logger.info({
//         msg: "[StatusWorker] Status job completed",
//         worker: "StatusJobWorker",
//         jobId: job.data.id
//     });
// })

// statusJobWorker.on("failed", (job, error) => {
//     logger.error({
//         msg: "[StatusWorker] Status job failed",
//         worker: "StatusJobWorker",
//         jobId: job?.data.id,
//         error: error instanceof Error ? error.message : error
//     });
// })

// statusJobWorker.on("error", (error) => {
//     logger.error({
//         msg: "[StatusWorker] StatusWorker error",
//         error: error.message,
//         stack: error.stack
//     });
// });

// process.on('unhandledRejection', (reason, promise) => {
//     logger.error({
//         msg: "[Worker] Unhandled rejection",
//         reason: reason instanceof Error ? reason.message : reason,
//         stack: reason instanceof Error ? reason.stack : undefined
//     });
// });

// process.on('uncaughtException', (error) => {
//     logger.error({
//         msg: "[Worker] Uncaught exception",
//         error: error.message,
//         stack: error.stack
//     });
// });

// statusJobWorker.on("closing", () => {
//     logger.info({ msg: "[StatusWorker] StatusWorker is closing" });
// });


const informer = k8s.makeInformer(
    kc,
    `/apis/batch/v1/namespaces/${namespace}/jobs`,
    () =>
        k8sBatchClient.listNamespacedJob({
            namespace: namespace,
            labelSelector: "app=script-runner",
            timeoutSeconds: 270,
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
