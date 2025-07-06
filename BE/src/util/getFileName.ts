export function getFileName(jobId: number, videoId: string, isCode: boolean): string {
    return isCode ? "code_" + jobId + "_" + videoId + ".py" : "video_" + jobId + "_" + videoId + ".mp4"
}