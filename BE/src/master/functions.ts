import { logger, redis } from "../util/config";
import { type Response } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { rm } from "fs/promises";
import { ProjectVideoDataArraySchema } from "../util/zodSchemas";
import type { ProjectVideoData } from "../types";
import { downloadFile, getSignedUrl, uploadFileToStorage } from "../util/gcp";

export function sendError(res: Response, status: number, message: string): void {
    res.status(status).json({ success: false, message });
}


export async function rewriteManifest(manifest: string, id: string, expiry: number): Promise<string> {
    logger.info({
        msg: "Starting manifest rewrite",
        videoId: id,
        expiry: expiry,
        manifestLines: manifest.split("\n").length
    });

    const lines = manifest.split("\n")
    const output: string[] = []

    for (const line of lines) {
        if (!line || line.startsWith("#")) {
            output.push(line);
            continue
        }
        const url = await getSignedUrl("videos", `video_${id}/${line.trim()}`, expiry)
        if (url) {
            output.push(url)
        } else {
            logger.warn({
                msg: "Failed to get signed URL for segment",
                videoId: id,
                segment: line.trim()
            });
        }
    }

    logger.info({
        msg: "Manifest rewrite completed",
        videoId: id,
        totalLines: lines.length
    });

    return output.join("\n")
}

export async function getManifestFile(id: string, expiry: number): Promise<string | void> {

    const manifestFilePath = `videos/video_${id}/playlist.m3u8`
    const manifestContent = await downloadFile(manifestFilePath)
    const keyUrl = await getSignedUrl("videos", `video_${id}/enc.key`, 5)

    if (manifestContent && keyUrl) {
        logger.info({
            msg: "Manifest and key retrieved successfully",
            videoId: id,
            manifestSize: manifestContent.length
        });

        const updatedManifest = manifestContent.replace(
            /#EXT-X-KEY:METHOD=AES-128,URI=".*?",IV=(0x[0-9a-fA-F]+)/,
            `#EXT-X-KEY:METHOD=AES-128,URI="${keyUrl}",IV=$1`
        )
        return await rewriteManifest(updatedManifest, id, expiry)
    } else {
        logger.error({
            msg: "Failed to retrieve manifest or key",
            videoId: id,
            hasManifest: !!manifestContent,
            hasKey: !!keyUrl
        });
        return
    }
}

export async function renderVideo(data: string, jobId: string): Promise<void> {
    const startTime = Date.now();
    logger.info({
        msg: "Starting video rendering",
        jobId: jobId,
        dataSize: data.length
    });

    try {
        const parsedData = ProjectVideoDataArraySchema.parse(JSON.parse(data))
        logger.info({
            msg: "Project data parsed successfully",
            jobId: jobId,
            videoCount: parsedData.length
        });

        let videos: (ProjectVideoData | number)[] = [];
        for (let i = 0; i < parsedData.length - 1; i++) {
            videos.push(parsedData[i])
            const blankTime = parsedData[i + 1].timelineStartTime - parsedData[i].timelineEndTime
            if (blankTime > 0) {
                videos.push(blankTime)
            }
        }

        if (parsedData.length > 0) {
            videos.push(parsedData[parsedData.length - 1])
        }

        const dir = `/tmp/${jobId}`;

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.info({
                msg: "Created temporary directory",
                jobId: jobId,
                directory: dir
            });
        }

        let count = 1
        logger.info({
            msg: "Starting video processing",
            jobId: jobId,
            totalVideos: videos.length
        });

        await Promise.all(
            videos.map(async (video, index) => {
                if (typeof video == "number") {
                    const duration = video
                    return createBlankVideo(duration, `${dir}/${index}.mp4`)
                        .then(async () => {
                            await redis.set(jobId, ((count / videos.length) * 80), "EX", 3600)
                            count++
                        })
                } else {
                    return cutVideo(video.videoId, video.startTime, video.endTime, `${dir}/${index}.mp4`)
                        .then(async () => {
                            await redis.set(jobId, ((count / videos.length) * 80), "EX", 3600)
                            count++
                        })
                }
            })
        )

        logger.info({
            msg: "Video processing completed, starting concatenation",
            jobId: jobId
        });

        const concatList = Array.from({ length: videos.length }, (_, i) => `file '${dir}/${i}.mp4'`).join("\n")

        await concatVideos(concatList, dir)

        redis.set(jobId, "90", "EX", 3600)

        logger.info({
            msg: "Uploading rendered video to storage",
            jobId: jobId
        });

        await uploadFileToStorage("project", `${jobId}.mp4`, `${dir}/rendered.mp4`)

        redis.set(jobId, "complete", "EX", 3600)

        logger.info({
            msg: "Cleaning up temporary directory",
            jobId: jobId,
            directory: dir
        });

        rm(dir, { recursive: true, force: true })
        
        const duration = Date.now() - startTime;
        logger.info({
            msg: "Video rendering completed successfully",
            jobId: jobId,
            duration: `${duration}ms`
        });

    } catch (err) {
        redis.set(jobId, "error", "EX", 3600)
        rm(`/tmp/${jobId}`, { recursive: true, force: true }).catch()
        logger.error({
            msg: "Video rendering failed",
            jobId: jobId,
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined,
        });
    }
}

async function concatVideos(concatList: string, projectFolderPath: string): Promise<void> {
    logger.info({
        msg: "Starting video concatenation",
        projectFolderPath: projectFolderPath,
        videoCount: concatList.split('\n').length
    });

    const listFile = path.join(projectFolderPath, `concat-list.txt`);
    fs.writeFileSync(listFile, concatList)
    const outputPath = projectFolderPath + "/rendered.mp4"

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            "-protocol_whitelist", "pipe,crypto,file,http,https,tcp,tls",
            '-f', 'concat',
            '-safe', '0',
            '-i', listFile,
            '-c', 'copy',
            '-movflags', '+faststart',
            '-bsf:a', 'aac_adtstoasc',
            outputPath,
        ])

        ffmpeg.on("error", err => {
            logger.error({
                msg: "FFmpeg concatenation error",
                error: err.message,
                projectFolderPath: projectFolderPath
            });
            reject(new Error(err.message));
        });

        ffmpeg.on("close", code => {
            if (code === 0) {
                logger.info({
                    msg: "Video concatenation completed successfully",
                    projectFolderPath: projectFolderPath,
                    outputPath: outputPath
                });
                resolve();
            } else {
                logger.error({
                    msg: "FFmpeg concatenation failed",
                    exitCode: code,
                    projectFolderPath: projectFolderPath
                });
                reject(new Error(`ffmpeg exited ${code}`));
            }
        });
    })
}

async function createBlankVideo(duration: number, outputPath: string): Promise<void> {

    return new Promise(async (resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
            '-y',
            "-f", "lavfi",
            "-i", `color=black:s=1280x720:d=${duration}`,
            "-f", "lavfi",
            "-i", "anullsrc=r=48000:cl=stereo",
            "-shortest",
            outputPath
        ])

        ffmpeg.on("error", err => {
            logger.error({
                msg: "FFmpeg blank video creation error",
                error: err.message,
                duration: duration,
                outputPath: outputPath
            });
            reject(new Error(err.message));
        });

        ffmpeg.on("close", code => {
            if (code === 0) {
                logger.info({
                    msg: "Blank video created successfully",
                    duration: duration,
                    outputPath: outputPath
                });
                resolve();
            } else {
                logger.error({
                    msg: "FFmpeg blank video creation failed",
                    exitCode: code,
                    duration: duration,
                    outputPath: outputPath
                });
                reject(new Error(`ffmpeg exited ${code}`));
            }
        });
    })
}

async function cutVideo(videoId: string, start: number, end: number, outputPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {

        const input = await getManifestFile(videoId, 10)
        if (!input) {
            logger.error({
                msg: "Failed to fetch manifest file for video cutting",
                videoId: videoId
            });
            return reject(new Error(`Error fetching manifest file for ${videoId}`))
        }

        const ffmpeg = spawn("ffmpeg", [
            '-y',
            "-protocol_whitelist", "pipe,crypto,file,http,https,tcp,tls",
            "-f", "hls",
            "-i", "pipe:0",
            "-ss", String(start),
            "-to", String(end),
            "-movflags", "frag_keyframe+empty_moov",
            "-c", "copy",
            outputPath
        ])

        ffmpeg.stdin.write(input)
        ffmpeg.stdin.end();

        ffmpeg.on("error", err => {
            logger.error({
                msg: "FFmpeg video cutting error",
                error: err.message,
                videoId: videoId,
                start: start,
                end: end,
                outputPath: outputPath
            });
            reject(new Error(err.message));
        });

        ffmpeg.on("close", code => {
            if (code === 0) {
                logger.info({
                    msg: "Video cutting completed successfully",
                    videoId: videoId,
                    start: start,
                    end: end,
                    outputPath: outputPath
                });
                resolve();
            } else {
                logger.error({
                    msg: "FFmpeg video cutting failed",
                    exitCode: code,
                    videoId: videoId,
                    start: start,
                    end: end,
                    outputPath: outputPath
                });
                reject(new Error(`ffmpeg exited ${code}`));
            }
        });
    })
}