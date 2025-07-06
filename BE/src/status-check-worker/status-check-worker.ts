process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


import { StatusQueue, k8sBatchClient, redis, prismaClient, JobQueue, k8sApi, logger } from "../util/config";
import { videoStatusEnum } from "../util/enums";
import type { JobData, StatusJobData } from "../types/types";

logger.log("k8s job status check worker started")

async function getPodLogs(jobName: string): Promise<string | null> {
    try {
        const pods = await k8sApi.listNamespacedPod({
            namespace: "vdogen",
            labelSelector: `job-name=${jobName}`
        });

        if (!pods.items || pods.items.length === 0) {
            return null;
        }

        const podName = pods.items[0].metadata?.name;
        if (!podName) {
            return null;
        }

        const podLogs = await k8sApi.readNamespacedPodLog({
            name: podName,
            namespace: "vdogen", 
            pretty: "true"
        });

        if (!podLogs || podLogs.trim() === '') {
            return null;
        }

        const trimmedLogs = podLogs.trim();
        
        if (!trimmedLogs.includes('manin_log_start') || !trimmedLogs.includes('manin_log_end')) {
            return null;
        }

        const parts = trimmedLogs.split('manin_log_start');
        if (parts.length < 2) {
            return null;
        }

        const logContent = parts[1].split('manin_log_end')[0];
        
        if (!logContent || logContent.trim() === '') {
            return null;
        }

        return logContent.trim();

    } catch (err) {
        return null;
    }
}

StatusQueue.process(async (statusJob) => {
    const { id, conversationId, k8sJobName, specs,userId } = statusJob.data

    try {
        const job = await k8sBatchClient.readNamespacedJobStatus({
            name: k8sJobName,
            namespace: 'vdogen'
        });
        const status = job.status;
        logger.info(`[StatusWorker] Checked k8s job status. k8sJobName=${k8sJobName}, status=${JSON.stringify(status)}`);
        // Handle successful jobs
        if (status?.succeeded) {
            await prismaClient.video.update({
                where: { id },
                data: { status: videoStatusEnum.COMPLETE }
            });
            await redis.set(`video:${id}`, videoStatusEnum.COMPLETE, 'EX', 3600);
            logger.info(`[StatusWorker] Job succeeded. id=${id}, k8sJobName=${k8sJobName}`);
            return;
        }
        // Handle failed jobs
        if (status?.failed) {
            const errorLogs = await getPodLogs(k8sJobName);
            logger.error(`[StatusWorker] Job failed. id=${id}, k8sJobName=${k8sJobName}, errorLogs=${errorLogs}`);
            if(errorLogs){
                const prompt = `got error from your previous response resolve it error: ${errorLogs}`;
                const newVideo = await prismaClient.video.create({
                    data: { conversationId, prompt, ...specs, userId: userId }
                })
                logger.info(`[StatusWorker] Created new video for retry. oldId=${id}, newId=${newVideo.id}`);
                await redis.set(`newVideo:${id}`, newVideo.id, 'EX', 3600)
                const jobData: JobData = { id, conversationId, prompt, specs, userId }
                // JobQueue new job
                await JobQueue.add(jobData)
                logger.info(`[StatusWorker] Re-queued job for new video. newId=${newVideo.id}`);
                await redis.set(`video:${newVideo.id}`, videoStatusEnum.INITIATED, "EX", 3600)
            }
            await prismaClient.video.update({
                where: { id },
                data: { isError: true, Error: "script error", status: videoStatusEnum.ERROR }
            })
            await redis.set(`video:${id}`, videoStatusEnum.ERROR, 'EX', 3600)
        }

        const statusJobData: StatusJobData = { k8sJobName, id, conversationId, specs, userId };
        await StatusQueue.add(statusJobData, { delay: 20_000 });
        logger.info(`[StatusWorker] Re-added status job to queue. k8sJobName=${k8sJobName}, id=${id}`);
        return

    } catch (error) {
        const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
        logger.error(`[StatusWorker] Exception in status check. id=${id}, k8sJobName=${k8sJobName}, error=${errorMsg}`);
        await prismaClient.video.update({
            where: { id },
            data: { isError: true, Error: errorMsg, status: videoStatusEnum.FAILED }
        });
        await redis.set(`video:${id}`, videoStatusEnum.FAILED, 'EX', 3600);
    }
});

