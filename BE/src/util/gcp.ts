import type { GetSignedUrlConfig } from "@google-cloud/storage";
import { bucketName, logger, storage } from "./config";


export async function uploadFileToStorage(storageFolderName: string, storageFileName: string, uploadFilePath: string, maxRetries = 3) {
    const options = {
        destination: `${storageFolderName}/${storageFileName}`
    };

 
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            logger.info({
                msg: "Attempting file upload",
                attempt: attempt + 1,
                maxRetries: maxRetries,
                destination: options.destination
            });
            
            await storage.bucket(bucketName).upload(uploadFilePath, options)
            
            logger.info({
                msg: "File uploaded successfully",
                storageFolderName: storageFolderName,
                storageFileName: storageFileName,
                destination: options.destination,
                attempt: attempt + 1
            });
            
            return
        } catch (err) {
            attempt++;
            logger.warn({
                msg: "File upload failed, retrying",
                attempt: attempt,
                maxRetries: maxRetries,
                destination: options.destination,
                error: err instanceof Error ? err.message : err
            });
            
            if (attempt >= maxRetries) {
                logger.error({
                    msg: "File upload failed after all retries",
                    storageFolderName: storageFolderName,
                    storageFileName: storageFileName,
                    uploadFilePath: uploadFilePath,
                    maxRetries: maxRetries,
                    error: err instanceof Error ? err.message : err,
                    stack: err instanceof Error ? err.stack : undefined
                });
                throw new Error("Failed to upload file to storage after retries")
            }
        }
    }
}

export async function getSignedUrl(folderName: string, fileName: string, expiry: number): Promise<string> {
    let url: string
    const options: GetSignedUrlConfig = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiry * 60 * 1000, //minutes
    };
    const file = storage.bucket(bucketName).file(`${folderName}/${fileName}`);
    const [exists] = await file.exists();
    if (!exists) {
        logger.error({
            msg: "File does not exist for signed URL generation",
            folderName: folderName,
            fileName: fileName,
            filePath: `${folderName}/${fileName}`,
            bucketName: bucketName
        });
        throw new Error(`File ${folderName}/${fileName} does not exist in bucket ${bucketName}`);
    }
    
    [url] = await file.getSignedUrl(options)
    
    logger.info({
        msg: "Signed URL generated successfully",
        folderName: folderName,
        fileName: fileName,
        filePath: `${folderName}/${fileName}`,
        expiry: expiry,
        urlLength: url.length
    });
    
    return url
}

export async function downloadFile(path: string): Promise<string | void> {

    const file = storage.bucket(bucketName).file(path)
    const [exists] = await file.exists()

    if (!exists) {
        logger.warn({
            msg: "File does not exist for download",
            path: path,
            bucketName: bucketName
        });
        return;
    }

    try {
        const [fileBuffer] = await file.download()
        const content = fileBuffer.toString('utf-8')
        
        logger.info({
            msg: "File downloaded successfully",
            path: path,
            contentLength: content.length
        });
        
        return content
    } catch (err) {
        logger.error({
            msg: "Failed to download file",
            path: path,
            bucketName: bucketName,
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined
        });
        throw err;
    }
}

export async function deleteFolder(folderName: string): Promise<void> {
    logger.info(`[Bucket] Attempting to delete folder: ${folderName}`);
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: `${folderName}/` })
    
    if (files.length === 0) {
        logger.info({
            msg: "No files found in folder",
            folderName: folderName
        });
        return
    }
    try {
        await Promise.all(
            files.map(async (file) => {
                await file.delete()
            })
        );
        
        logger.info({
            msg: "Successfully deleted all files in folder",
            folderName: folderName,
            fileCount: files.length
        });
    } catch (err) {
        logger.error({
            msg: "Error deleting files in folder",
            folderName: folderName,
            fileCount: files.length,
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined
        });
    }
}

export async function deleteFile(filePath: string): Promise<void> {
    const file = storage.bucket(bucketName).file(filePath)
    try {
        await file.delete({ ignoreNotFound: true })
        
        logger.info({
            msg: "File deleted successfully",
            filePath: filePath
        });
    } catch (err) {
        logger.error({
            msg: "Error deleting file",
            filePath: filePath,
            bucketName: bucketName,
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined
        });
        return
    }
}
