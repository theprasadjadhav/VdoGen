import dotenv from "dotenv"
import type { JobResponse, StatusJobData, VideoSpecsType } from "../types/types";
import seedDataValid from "../util/llmResValid.json" assert { type: "json"}
import seedDataInvalid from "../util/llmResInvalid.json" assert { type: "json"}
import { videoStatusEnum } from "../util/enums";
import fs from "fs";
import path from "path";
import { getVideoDimensions } from "../util/getVideoDimentions";
import { k8s, k8sBatchClient, Anthropic, anthropic, storage, prismaClient, redis, bucketName, JobQueue, StatusQueue } from "../util/config";
import { getFileName } from "../util/getFileName";
import { logger } from "../util/config";


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

dotenv.config()

logger.log("worker started")

function getParams(messages: Anthropic.Messages.MessageParam[]): Anthropic.MessageCreateParams {

    let systemPrompt:string = process.env.SYSTEM_PROMPT || ""

    const params: Anthropic.MessageCreateParams = {
        model: process.env.ANTHROPIC_MODEL as Anthropic.Model,
        max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '6000'),
        system: systemPrompt,
        messages
    }
    return params
}

async function createMessages (prompt: string, duration: string, conversationId: string): Promise<Anthropic.Messages.MessageParam[]> {

    let userPrompt:string = process.env.USER_PROMPT || ""


    let messages: Anthropic.Messages.MessageParam[] = [{
        role: "user",
        content: userPrompt
    }]


    const context = await prismaClient.video.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' }
    })

    if (context.length > 0) {
        context.forEach(c => {
            messages.push({
                role: "user",
                content: c.prompt
            })
        })

        const lastContext = context[context.length - 1]
        if (lastContext.codeFileName) {
            const codeFileName = "code_" + lastContext.id + "_" + lastContext.conversationId + ".py"
            const [codeBuffer] = await storage.bucket(bucketName).file(`code/${codeFileName}`).download()
            const code = codeBuffer.toString('utf-8')
            messages.push({
                role: "assistant",
                content: code
            })
        }
    }

    messages.push(
        {
            role: "user",
            content: prompt
        })

    return messages
}

async function createK8sJob(jobId: number, codeFileName: string, specs: VideoSpecsType, maxRetries = 3): Promise<string> {
    const jobName = "job-" + jobId
    const bucket = bucketName
    const resolution = getVideoDimensions(specs.aspectRatio, specs.resolution)

    const jobManifest: k8s.V1Job = {
        "apiVersion": "batch/v1",
        kind: "Job",
        metadata: {
            name: jobName
        },
        spec: {
            ttlSecondsAfterFinished: 120,
            activeDeadlineSeconds: 3600,
            backoffLimit: 1,
            template: {
                spec: {
                    restartPolicy: "Never",
                    containers: [
                        {
                            name: "script-runner",
                            image: "prasadev/manim",
                            env: [
                                { name: "CODE_FILE_NAME", value: codeFileName },
                                { name: "RESOLUTION", value: resolution },
                                { name: "FPS", value: specs.fps },
                                { name: "BUCKET", value: bucket },
                                { name: "ID", value: jobId.toString() }
                            ],
                            command: [
                                'sh', '-c',
                                `gcloud auth activate-service-account --key-file=/var/secrets/google/key.json && \
                                gsutil cp gs://$BUCKET/code/$CODE_FILE_NAME script.py && \
                                echo manin_log_start && \
                                manim script.py -o rendered.mp4 -r $RESOLUTION --fps $FPS --format mp4 --media_dir . && \
                                echo manin_log_end && \
                                VIDEO_PATH=$(find videos -type f -name rendered.mp4) && \
                                mkdir video_$ID && \
                                openssl rand 16 > video_$ID/enc.key && \
                                echo "http://localhost:8081/video/$ID/key" > video_$ID/enc.keyinfo && \
                                echo "video_$ID/enc.key" >> video_$ID/enc.keyinfo && \
                                ffmpeg -i $VIDEO_PATH -codec: copy -hls_time 5 -hls_playlist_type vod -hls_segment_filename video_$ID/segment_%03d.ts -hls_key_info_file video_$ID/enc.keyinfo video_$ID/playlist.m3u8 && \
                                gsutil -m cp -r video_$ID gs://$BUCKET/videos`
                            ],
                            volumeMounts: [
                                {
                                    name: "gcp-keys-volume",
                                    readOnly: true,
                                    mountPath: "/var/secrets/google"
                                }
                            ]
                        }
                    ],
                    volumes: [
                        {
                            name: "gcp-keys-volume",
                            secret: {
                                secretName: "gcp-keys-secret"
                            }
                        }
                    ]
                }
            },
        }
    }
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            await k8sBatchClient.createNamespacedJob({ namespace: "vdogen", body: jobManifest })
            return jobName
        } catch (err) {
            attempt++;
            if (attempt >= maxRetries) {
                let message = "Failed to create k8s job after retries";
                if (err instanceof Error && err.message) {
                    message += `: ${err.message}`;
                }
                throw new Error(message);
            }
        }
    }
    throw new Error("Failed to create k8s job")
}

async function uploadFileToStorage(codeFilePath: string, codeFileName: string, maxRetries = 3) {
    const options = {
        destination: `code/${codeFileName}`,
        preconditionOpts: { ifGenerationMatch: 0 },
    };
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            await storage.bucket(bucketName).upload(codeFilePath, options);
            return;
        } catch (err) {
            attempt++;
            if (attempt >= maxRetries) throw new Error("Failed to upload file to storage after retries")
        }
    }
}

function createFile(content: string, jobId: number, conversationId: string): { codeFilePath: string, codeFileName: string } {
    const dir = "/tmp/vdogen"
    fs.mkdirSync(dir, { recursive: true })

    const codeFileName = getFileName(jobId, conversationId, true)

    const codeFilePath = path.join(dir, codeFileName)

    try {
        fs.writeFileSync(codeFilePath, content, "utf-8")
    } catch (err) {
        throw new Error("Failed to write code file")
    }
    return { codeFilePath, codeFileName }
}

JobQueue.process(async (job): Promise<JobResponse> => {

    logger.info(`[Worker] Processing job. id=${job.data.id}, conversationId=${job.data.conversationId}`);
    try {
        const { prompt, specs, conversationId, id, userId } = job.data

        const messages = await createMessages(prompt, specs.duration, conversationId)

        let llmResponse
        if(process.env.NODE_ENV === "production"){
            logger.info(`[Worker] Calling LLM for job id=${id}`);
            llmResponse = await anthropic.messages.create(getParams(messages)) as Anthropic.Message;
        }else{
            logger.info(`[Worker] Using seed LLM data for job id=${id}`);
            llmResponse = seedDataValid as unknown as Anthropic.Message;
        }

        if (!llmResponse || !llmResponse.content || !Array.isArray(llmResponse.content)) {
            logger.error(`[Worker] LLM response invalid or empty for job id=${id}`);
            return {
                status: videoStatusEnum.FAILED,
                message: "LLM response is invalid or empty",
                conversationId,
                id
            }
        }

        const content = llmResponse.content.find(x => x.type === "text")?.text as string
        if (!content || typeof content !== "string" || !content.trim()) {
            logger.error(`[Worker] LLM response content empty for job id=${id}`);
            return {
                status: videoStatusEnum.FAILED,
                message: "LLM response content is empty",
                conversationId,
                id
            }
        }

        // Handle invalid prompts
        if (content.startsWith("I'm sorry")) {
            logger.info(`[Worker] LLM returned invalid prompt for job id=${id}`);
            return {
                status: videoStatusEnum.INVALID_PROMPT,
                message: content,
                conversationId: conversationId,
                id: id
            }
        }
        const cleanedContent = content.replace(/^```python\n|```$/g, '')
        const { codeFilePath, codeFileName } = createFile(cleanedContent, id, conversationId)
        logger.info(`[Worker] Code file created for job id=${id}: ${codeFileName}`);

        await uploadFileToStorage(codeFilePath, codeFileName)
        logger.info(`[Worker] Uploaded code file to storage for job id=${id}: ${codeFileName}`);
        fs.unlinkSync(codeFilePath)

        await prismaClient.video.update({
            where: { id },
            data: {
                codeFileName: codeFileName
            }
        })
        logger.info(`[Worker] Updated DB with code file for job id=${id}`);

        const jobName = await createK8sJob(id, codeFileName, specs)
        logger.info(`[Worker] Created k8s job for job id=${id}: ${jobName}`);

        const statusJobData: StatusJobData = { k8sJobName: jobName, id, conversationId, specs,userId }
        await StatusQueue.add(statusJobData, { delay: 10_000})
        logger.info(`[Worker] Added status job to queue for job id=${id}, k8sJobName=${jobName}`);

        return {
            status: videoStatusEnum.PROCESSING,
            message: "Video generation started",
            conversationId: conversationId,
            id: id,
            jobName: jobName
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            logger.error(`[Worker] Error processing job id=${job.data?.id}: ${error.message}`);
            return {
                status: videoStatusEnum.FAILED,
                message: error.message,
                conversationId: job.data?.conversationId || "",
                id: job.data?.id || 0
            }
        }
        logger.error(`[Worker] Unknown error processing job id=${job.data?.id}`);
        return {
            status: videoStatusEnum.FAILED,
            message: 'An unknown error occurred',
            conversationId: job.data?.conversationId || "",
            id: job.data?.id || 0
        }
    }
})

JobQueue.on("failed", async (job, error) => {
    logger.error(`[Worker] Job failed. id=${job.data.id}, error=${error.message}`);
    await prismaClient.video.update({
        where: { id: job.data.id },
        data: {
            status: videoStatusEnum.FAILED,
            isError: true,
            Error: error.message
        }
    })
    await redis.set(`video:${job.data.id}`, videoStatusEnum.FAILED, 'EX', 3600)
})

JobQueue.on("completed", async (job) => {
    logger.info(`[Worker] Job processed successfully. id=${job.data.id}`);
    const res: JobResponse = job.returnvalue
    logger.info(`[Worker] Job completed. id=${job.data.id}, status=${res.status}`);
    if (res.status === videoStatusEnum.INVALID_PROMPT) {
        await prismaClient.video.update({
            where: { id: job.data.id },
            data: {
                status: res.status,
                isError: true,
                Error: res.message
            }
        })
        await redis.set(`video:${job.data.id}`, videoStatusEnum.INVALID_PROMPT, 'EX', 3600)
    } else {
        await prismaClient.video.update({
            where: { id: job.data.id },
            data: {
                status: res.status,
            }
        })
        await redis.set(`video:${job.data.id}`, res.status, 'EX', 3600)
    }
})



