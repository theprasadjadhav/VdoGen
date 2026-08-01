import { Job, Worker } from "bullmq";
import type { AspectRatioType, JobData, JobResponse, ResolutionType, VideoSpecsType } from "../types";
import seedDataValid from "../util/llmResValid.json" with { type: "json"}
import seedDataInvalid from "../util/llmResInvalid.json" with { type: "json"}
import seedDataError from "../util/llmResError.json" with { type: "json"}
import { resolutionMap, videoStatusEnum } from "../types";
import fs from "fs";
import path from "path";
import { k8s, k8sBatchClient, Anthropic, anthropic, prismaClient, redis, bucketName, redisConfig, k8sApi, namespace } from "../util/config";
import { logger } from "../util/config";
import { downloadFile, uploadFileToStorage } from "../util/gcp";

logger.info({
    msg: "Video generator worker process started",
    environment: process.env.NODE_ENV,
    pid: process.pid,
    redisHost: process.env.REDIS_URL,
    redisPort: process.env.REDIS_PORT
})

async function getPodLogs(jobName: string): Promise<string | null> {
    try {
        const pods = await k8sApi.listNamespacedPod({
            namespace: namespace,
            labelSelector: `job-name=${jobName}`
        });

        if (!pods.items || pods.items.length === 0) {
            logger.warn({
                msg: "No pods found for job",
                jobName: jobName
            });
            return null;
        }

        const podName = pods.items[0].metadata?.name;
        if (!podName) {
            logger.warn({
                msg: "Pod name not found",
                jobName: jobName
            });
            return null;
        }

        logger.info({
            msg: "Reading pod logs",
            jobName: jobName,
            podName: podName
        });

        const podLogs = await k8sApi.readNamespacedPodLog({
            name: podName,
            namespace: namespace,
            pretty: "true"
        });

        logger.info({
            msg: "Raw pod logs obtained",
            jobName: jobName,
            podName: podName,
        });

        if (!podLogs || podLogs.trim() === '') {
            logger.warn({
                msg: "Empty pod logs",
                jobName: jobName,
                podName: podName
            });
            return null;
        }

        const trimmedLogs = podLogs.trim();


        if (!trimmedLogs.includes('=== manim_log_start ===') || !trimmedLogs.includes('=== manim_log_end ===')) {
            logger.warn({
                msg: "Pod logs missing manim markers",
                jobName: jobName,
                podName: podName,
                logLength: trimmedLogs.length
            });
            return null;
        }

        const parts = trimmedLogs.split('=== manim_log_start ===');
        if (parts.length < 2) {
            logger.warn({
                msg: "Invalid log format - missing start marker",
                jobName: jobName,
                podName: podName
            });
            return null;
        }

        const logContent = parts[1].split('=== manim_log_end ===')[0];

        if (!logContent || logContent.trim() === '') {
            logger.warn({
                msg: "Empty log content between markers",
                jobName: jobName,
                podName: podName
            });
            return null;
        }

        logger.info({
            msg: "Successfully extracted pod logs",
            jobName: jobName,
            podName: podName,
            logContentLength: logContent.trim().length
        });

        return logContent.trim();

    } catch (err) {
        logger.error({
            msg: "Failed to fetch pod logs",
            jobName: jobName,
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined
        });
        return null;
    }
}

function createUserPrompt(specs: VideoSpecsType, prompt: string, isFailed: boolean = false, podLogs?: string) {

    let userPrompt = `
    ## Technical Specifications
        ## AUTHORITATIVE MUST BE OBEYED
            • Duration: ${specs.duration} seconds
        ## context only DO NOT use in code
            • Resolution: ${specs.resolution}
            • Aspect Ratio: ${specs.aspectRatio}
            • FPS: ${specs.fps}
        Do NOT set, infer, calculate, or reference resolution, FPS,
        aspect ratio, or Manim config inside the script.
    ## Animation Request
        ${prompt}`

    if (isFailed) {
        return `Your previous response encountered an error during execution. Please carefully review and resolve the following error and generate new script:\n\nPrevious prompt:\n${userPrompt}\n\nError:\n${podLogs}\n\nProvide a corrected and fully functional script by resolving the issues.`;
    }
    return userPrompt
}

function getVideoDimensions(aspectRatio: AspectRatioType, resolution: ResolutionType): string {
    const dims = resolutionMap[aspectRatio]?.[resolution];

    if (!dims) {
        throw new Error(`Unsupported combination: ${aspectRatio} at ${resolution}`);
    }

    return `${dims.width},${dims.height}`;
}

function getParams(messages: Anthropic.Messages.MessageParam[]): Anthropic.MessageCreateParams {

    let systemPrompt: string = process.env.SYSTEM_PROMPT || ""

    const params: Anthropic.MessageCreateParams = {
        model: process.env.AI_PROVIDER === "anthropic" ? process.env.ANTHROPIC_MODEL! : process.env.DEEPSEEK_MODEL!,
        max_tokens: parseInt(process.env.MAX_TOKENS || '6000'),
        system: systemPrompt,
        thinking: {
            type: "disabled",
        },
        messages
    }
    return params
}

async function createMessages(userPrompt: string, conversationId: string, id: number, isFailed?: boolean): Promise<Anthropic.Messages.MessageParam[]> {

    let messages: Anthropic.Messages.MessageParam[] = []

    logger.info({
        msg: "[createMessages] Fetching conversation history",
        conversationId,
        currentId: id,
        isFailed
    });

    const conversationHistory = await prismaClient.video.findMany({
        where: {
            conversationId,
            NOT: { id: id }
        },
        orderBy: { createdAt: 'asc' }
    });

    logger.info({
        msg: "[createMessages] Conversation history fetched",
        conversationId,
        historyCount: conversationHistory.length
    });

    if (conversationHistory.length > 0) {

        const lastFive = conversationHistory.slice(-5);

        for (const c of lastFive) {
            const spec: VideoSpecsType = {
                fps: c.fps as VideoSpecsType["fps"],
                resolution: c.resolution as VideoSpecsType["resolution"],
                duration: c.duration as VideoSpecsType["duration"],
                aspectRatio: c.aspectRatio as VideoSpecsType["aspectRatio"]
            };

            const prompt = createUserPrompt(spec, c.prompt);
            messages.push({
                role: "user",
                content: `${prompt}`
            });

            logger.debug({
                msg: "[createMessages] Added user message from conversation history",
                conversationId,
                videoId: c.id
            });
        }

        if (!isFailed) {
            const lastContext = conversationHistory[conversationHistory.length - 1];
            if (lastContext.codeFileName) {
                const codeFilePath = "code/" + lastContext.codeFileName

                logger.info({
                    msg: "[createMessages] Attempting to download code file for previous conversation context",
                    codeFilePath,
                    lastContextId: lastContext.id
                });

                const code = await downloadFile(codeFilePath);

                if (code) {
                    messages.push({
                        role: "assistant",
                        content: code
                    });
                    logger.info({
                        msg: "[createMessages] Added assistant code file from context",
                        codeFilePath
                    });
                } else {
                    logger.warn({
                        msg: "[createMessages] No code found at expected file path",
                        codeFilePath
                    });
                }
            }
        }
    }

    if (isFailed) {
        const codeFilePath = "code/code_" + id + "_" + conversationId + ".py";

        logger.info({
            msg: "[createMessages] Attempting to download code file due to failed previous job",
            codeFilePath,
            id,
            conversationId
        });

        const code = await downloadFile(codeFilePath);

        if (code) {
            messages.push({
                role: "assistant",
                content: code
            });
            logger.info({
                msg: "[createMessages] Added failed job's assistant code",
                codeFilePath
            });
        } else {
            logger.warn({
                msg: "[createMessages] No code found for failed job at expected file path",
                codeFilePath
            });
        }
    }

    messages.push({
        role: "user",
        content: `${userPrompt} `
    });

    logger.info({
        msg: "[createMessages] Final messages array ready",
        messagesCount: messages.length,
        conversationId,
        id,
        isFailed
    });

    return messages;
}

function getJobName(id: number, retry: number) {
    return `job-${id}-${retry}`
}

async function createK8sJob(id: number, retry: number, codeFileName: string, specs: VideoSpecsType, userId: string, maxRetries = 3): Promise<string> {
    const jobName = getJobName(id, retry)
    const bucket = bucketName
    const resolution = getVideoDimensions(specs.aspectRatio, specs.resolution)

    const jobManifest: k8s.V1Job = {
        "apiVersion": "batch/v1",
        kind: "Job",
        metadata: {
            name: jobName,
            labels: {
                app: "script-runner",
                videoId: String(id),
                retry: String(retry),
                userId: userId
            }
        },
        spec: {
            ttlSecondsAfterFinished: 3600, // This would automatically clean up the job and its pods (3600 seconds = 1 hour) after completion
            activeDeadlineSeconds: 3600,  // This sets the maximum time (in seconds) the job can run (3600 seconds = 1 hour)
            backoffLimit: 0,
            template: {
                spec: {
                    restartPolicy: "Never",
                    containers: [
                        {
                            name: "script-runner",
                            image: "docker.io/prasadev/manim",
                            env: [
                                { name: "CODE_FILE_NAME", value: codeFileName },
                                { name: "RESOLUTION", value: resolution },
                                { name: "FPS", value: specs.fps },
                                { name: "BUCKET", value: bucket },
                                { name: "ID", value: String(id) }
                            ],
                            command: [
                                'sh', '-c',
                                `
                                set -e  # Exit on any error

                                echo "=== Starting Video Processing Pipeline ==="

                                # Step 1: Authenticate with GCloud
                                echo "Authenticating with gcloud..."
                                if ! gcloud auth activate-service-account --key-file=/var/secrets/google/key.json; then
                                    echo "ERROR: gcloud authentication failed"
                                    exit 1
                                fi
                                echo "gcloud auth successful"

                                # Step 2: Download code file
                                echo "Downloading code file from gs://$BUCKET/code/$CODE_FILE_NAME..."
                                if ! gsutil cp "gs://$BUCKET/code/$CODE_FILE_NAME" script.py; then
                                    echo "ERROR: Failed to download code file"
                                    exit 1
                                fi
                                echo "Code file downloaded successfully"

                                # Step 3: Execute Manim
                                echo "=== manim_log_start ==="
                                if ! manim script.py MainScene -o rendered.mp4 -r "$RESOLUTION" --fps "$FPS" --format mp4 --media_dir .; then
                                    echo "ERROR: Manim rendering failed"
                                    echo "=== manim_log_end ==="
                                    exit 1
                                fi
                                echo "=== manim_log_end ==="

                                # Step 4: Locate rendered video
                                echo "Searching for rendered video..."
                                VIDEO_PATH=$(find . -type f -name "rendered.mp4" 2>/dev/null | head -n 1)

                                if [ -z "$VIDEO_PATH" ]; then
                                    echo "ERROR: rendered.mp4 not found"
                                    echo "Directory contents:"
                                    find . -type f -name "*.mp4"
                                    exit 1
                                fi
                                echo "Found video at: $VIDEO_PATH"

                                # Step 5: Create output directory
                                OUTPUT_DIR="video_$ID"
                                mkdir -p "$OUTPUT_DIR"

                                # Step 6: Generate encryption key
                                openssl rand 16 > "$OUTPUT_DIR/enc.key"

                                # Step 7: Create keyinfo file
                                echo "http://localhost:8081/video/$ID/key" > $OUTPUT_DIR/enc.keyinfo
                                echo "$OUTPUT_DIR/enc.key" >> $OUTPUT_DIR/enc.keyinfo

                                # Step 8: Convert to HLS with encryption
                                echo "Converting to HLS format..."
                                if ! ffmpeg -i "$VIDEO_PATH" \
                                    -c copy \
                                    -hls_time 5 \
                                    -hls_playlist_type vod \
                                    -hls_segment_filename "$OUTPUT_DIR/segment_%03d.ts" \
                                    -hls_key_info_file "$OUTPUT_DIR/enc.keyinfo" \
                                    "$OUTPUT_DIR/playlist.m3u8"; then
                                    echo "ERROR: FFmpeg conversion failed"
                                    exit 1
                                fi
                                echo "HLS conversion successful"

                                # Step 9: Upload to GCS
                                echo "Uploading to gs://$BUCKET/videos/$OUTPUT_DIR..."
                                if ! gsutil -m cp -r "$OUTPUT_DIR" "gs://$BUCKET/videos/"; then
                                    echo "ERROR: Upload to GCS failed"
                                    exit 1
                                fi
                                echo "Upload successful"
                                echo "=== Video Processing Complete ==="
                                `
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
                    imagePullSecrets: [
                        {
                            name: "docker-cred-secret"
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
            await k8sBatchClient.createNamespacedJob({ namespace: namespace, body: jobManifest });

            logger.info({
                msg: "Kubernetes job created successfully",
                jobName: jobName,
                attempt: attempt + 1
            });

            return jobName;
        } catch (err) {
            attempt++;
            logger.warn({
                msg: "Failed to create Kubernetes job, retrying",
                jobName: jobName,
                attempt: attempt,
                maxRetries: maxRetries,
                error: err instanceof Error ? err.message : err
            });

            if (attempt >= maxRetries) {
                let message = "Failed to create k8s job after retries";
                if (err instanceof Error && err.message) {
                    message += `: ${err}`;
                }

                logger.error({
                    msg: "Failed to create Kubernetes job after all retries",
                    jobName: jobName,
                    maxRetries: maxRetries,
                    error: err instanceof Error ? err.message : err,
                    stack: err instanceof Error ? err.stack : undefined
                });

                throw new Error(message);
            }
        }
    }
    //unreachable
    throw new Error("Failed to create k8s job")
}

function createFile(content: string, jobId: number, conversationId: string): { codeFilePath: string, codeFileName: string } {
    const dir = "/tmp/code"
    fs.mkdirSync(dir, { recursive: true })

    const codeFileName = `code_${jobId}_${conversationId}.py`
    const codeFilePath = path.join(dir, codeFileName)

    try {
        fs.writeFileSync(codeFilePath, content, "utf-8")
        logger.info({
            msg: "Code file created successfully",
            jobId: jobId,
            conversationId: conversationId,
            codeFileName: codeFileName,
            codeFilePath: codeFilePath
        });
    } catch (err) {
        logger.error({
            msg: "Failed to write code file",
            jobId: jobId,
            conversationId: conversationId,
            codeFileName: codeFileName,
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined
        });
        throw new Error("Failed to write code file")
    }
    return { codeFilePath, codeFileName }
}

async function jobProcessor(job: Job): Promise<JobResponse> {
    try {
        const { prompt, specs, conversationId, id, userId, retry, isFailed } = job.data

        logger.info({
            msg: "[Worker] Creating LLM prompt messages",
            id,
            conversationId,
            duration: specs.duration,
            retry
        });

        let userPrompt = ""
        if (isFailed) {
            const jobName = getJobName(id, retry - 1)
            const podLogs = await getPodLogs(jobName)
            if (!podLogs) {
                return {
                    status: videoStatusEnum.FAILED,
                    message: "Failed to retrieve pod logs for failed job.",
                    conversationId: conversationId,
                    id: id
                }
            }
            userPrompt = createUserPrompt(specs, prompt, isFailed, podLogs)
        } else {
            userPrompt = createUserPrompt(specs, prompt)
        }

        const messages = await createMessages(userPrompt, conversationId, id, isFailed)

        let llmResponse = null
        if (process.env.NODE_ENV === "production") {
            logger.info({
                msg: "[Worker] Calling LLM",
                id
            });
            const stream = anthropic.messages.stream(getParams(messages));

            const message = await stream.finalMessage();
            llmResponse = message.content.filter(c => c.type === "text").map(c => c.text).join("");

        } else {
            if (prompt === "ERROR") {
                logger.info({
                    msg: "[Worker] Using seed LLM data - ERROR",
                    id
                });
                llmResponse = seedDataError.content.filter(c => c.type === "text").map(c => c.text).join("")

            } else if (prompt === "INVALID") {
                logger.info({
                    msg: "[Worker] Using seed LLM data - INVALID",
                    id
                });
                llmResponse = seedDataInvalid.content.filter(c => c.type === "text").map(c => c.text).join("")
            } else {
                logger.info({
                    msg: "[Worker] Using seed LLM data - VALID",
                    id
                });
                llmResponse = seedDataValid.content.filter(c => c.type === "text").map(c => c.text).join("")
            }
        }

        if (!llmResponse || typeof llmResponse !== "string" || !llmResponse.trim()) {
            logger.error({
                msg: "[Worker] LLM response invalid or empty",
                id
            });
            return {
                status: videoStatusEnum.FAILED,
                message: "LLM response is invalid or empty",
                conversationId,
                id
            }
        }
        // Handle invalid prompts
        if (llmResponse.startsWith("I'm sorry")) {
            logger.info({
                msg: "[Worker] LLM returned invalid prompt",
                id,
                llmResponse
            });
            return {
                status: videoStatusEnum.INVALID_PROMPT,
                message: llmResponse,
                conversationId: conversationId,
                id: id
            }
        }

        logger.info({
            msg: "[Worker] Cleaning LLM response content",
            id
        });
        const cleanedContent = llmResponse.replace('```python\n', '').replace('```', '')
        const { codeFilePath, codeFileName } = createFile(cleanedContent, id, conversationId)
        logger.info({
            msg: "[Worker] Code file created",
            id,
            codeFileName,
            codeFilePath
        });

        await uploadFileToStorage("code", codeFileName, codeFilePath)
        logger.info({
            msg: "[Worker] Uploaded code file to storage",
            id,
            codeFileName
        });

        fs.unlinkSync(codeFilePath)

        logger.info({
            msg: "[Worker] Updating DB with code file",
            id,
            codeFileName
        });
        await prismaClient.video.update({
            where: { id },
            data: {
                codeFileName: codeFileName
            }
        })
        logger.info({
            msg: "[Worker] Updated DB with code file",
            id,
            codeFileName
        });

        const jobName = await createK8sJob(id, retry, codeFileName, specs, userId)
        logger.info({
            msg: "[Worker] Created k8s job",
            id,
            jobName
        });

        return {
            status: videoStatusEnum.PROCESSING,
            message: "Video generation started",
            conversationId: conversationId,
            id: id,
            jobName: jobName,
        }
    } catch (error: unknown) {
        logger.error({
            msg: "[Worker] Error processing job",
            id: job.data?.id,
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
        });
        return {
            status: videoStatusEnum.FAILED,
            message: error instanceof Error ? error.message : 'An unknown error occurred',
            conversationId: job.data?.conversationId || "",
            id: job.data?.id || 0
        }
    }
}

try {
    await redis.ping();
    logger.info({
        msg: "Redis connection verified",
        queueName: 'Job-Queue'
    });
} catch (error) {
    logger.error({
        msg: "Failed to connect to Redis",
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
}

logger.info({
    msg: "Initializing worker",
    queueName: 'Job-Queue',
});

const jobWorker = new Worker<JobData, JobResponse>(
    'Job-Queue',
    jobProcessor,
    {
        connection: redisConfig,
        concurrency: 5,
        removeOnComplete: {
            count: 1,
            age: 3600
        },
        removeOnFail: {
            count: 1,
            age: 3600
        }
    }
);

jobWorker.on("ready", () => {
    logger.info({
        msg: "[Worker] Worker is ready and listening for jobs",
        queueName: 'Job-Queue'
    });
});

jobWorker.on("active", (job) => {
    logger.info({
        msg: "[Worker] Job started processing",
        id: job?.id,
        videoId: job?.data?.id
    });
});

jobWorker.on("failed", async (job, error) => {
    if (!job) return;
    try {
        logger.error({
            msg: "[Worker] Job failed",
            id: job.data.id,
            retry: job.data.retry,
            error: error.message,
            stack: error.stack
        });
        await prismaClient.video.update({
            where: { id: job.data.id },
            data: {
                status: videoStatusEnum.FAILED,
                isError: true,
                Error: error.message
            }
        })
        await redis.set(`video:${job.data.userId}:${job.data.id}`, videoStatusEnum.FAILED, 'EX', 3600)
        logger.info({
            msg: "[Worker] Updated DB and cache after failed job",
            id: job.data.id
        });
    } catch (err) {
        logger.error({
            msg: "[Worker] Error handling failed job",
            id: job.data?.id,
            error: (err instanceof Error) ? err.message : err
        });
    }
})

jobWorker.on("completed", async (job) => {
    if (!job) return;
    try {
        logger.info({
            msg: "[Worker] Job processed successfully",
            id: job.data.id,
            retry: job.data.retry
        });
        const res: JobResponse = job.returnvalue as JobResponse
        logger.info(`[Worker] Job completed. id=${job.data.id}, status=${res.status}`);
        if (res.status === videoStatusEnum.PROCESSING) {
            await prismaClient.video.update({
                where: { id: job.data.id },
                data: {
                    status: res.status
                }
            });
            await redis.set(`video:${job.data.userId}:${job.data.id}`, res.status, 'EX', 3600);
            logger.info({
                msg: "[Worker] Updated DB and cache for status PROCESSING",
                id: job.data.id,
                status: res.status
            });
        } else {
            await prismaClient.video.update({
                where: { id: job.data.id },
                data: {
                    status: res.status,
                    isError: true,
                    Error: res.message
                }
            });
            await redis.set(`video:${job.data.userId}:${job.data.id}`, res.status, 'EX', 3600);
            logger.info({
                msg: "[Worker] Updated DB and cache with error/state",
                id: job.data.id,
                status: res.status
            });
        }
    } catch (err) {
        logger.error({
            msg: "[Worker] Error handling completed job",
            id: job.data?.id,
            error: (err instanceof Error) ? err.message : err
        });
    }
})

jobWorker.on("error", (error) => {
    logger.error({
        msg: "[Worker] Worker error",
        error: error.message,
        stack: error.stack,
        name: error.name
    });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error({
        msg: "[Worker] Unhandled rejection",
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
    });
});

process.on('uncaughtException', (error) => {
    logger.error({
        msg: "[Worker] Uncaught exception",
        error: error.message,
        stack: error.stack
    });
});

jobWorker.on("closing", () => {
    logger.info({ msg: "[Worker] Worker is closing" });
});

