import type { GetSignedUrlConfig } from "@google-cloud/storage";
import { storage, bucketName, logger } from "../util/config";
import { type Response } from "express";



export async function getSignedUrl(fileName: string, expiry: number): Promise<string> {
    let url: string;
    try {
        const options: GetSignedUrlConfig = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + expiry * 60 * 1000,
        };
        [url] = await storage.bucket(bucketName).file(`videos/${fileName}`).getSignedUrl(options);
    } catch (error) {
        logger.error(`Failed to generate signed URL for ${fileName}: ${error}`);
        throw error;
    }
    return url
}

export async function rewriteManifest(manifest: string, id: string): Promise<string> {

    const lines = manifest.split("\n")
    const output: string[] = []

    for (const line of lines) {
        if (!line || line.startsWith("#")) {
            output.push(line);
            continue
        }
        const url = await getSignedUrl(`video_${id}/${line.trim()}`, 60)
        output.push(url)
    }
    return output.join("\n")
}

export const sendError = (
    res: Response,
    status: number,
    message: string
): void => {
    res.status(status).json({ success: false, message });
};