import { Router } from "express";
import { logger, prismaClient } from "../../util/config";
import { sendError } from "../functions";
import { deleteFile, deleteFolder } from "../../util/gcp";

const contentRouter = Router();

contentRouter.get("/history", async (req, res) => {
    const userId = req.user?.id!

    try {
        logger.info({
            msg: "Fetching history",
            route: "/history",
            userId
        });
        const history = await prismaClient.conversation.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select:{
                id:true,
                firstPrompt: true
            }
        });
        logger.info({
            msg: "Found conversations",
            route: "/history",
            userId,
            count: history.length
        });
        res.status(200).json({
            success: true,
            message: "History fetched successfully",
            history
        });
    } catch (error) {
        logger.error({
            msg: "Failed to fetch history",
            route: "/history",
            userId,
            error: error instanceof Error ? error.message : error
        });
        sendError(res, 500, "Failed to fetch history");
        return;
    }
});

contentRouter.get("/conversation/:conversationId", async (req, res) => {
    const userId = req.user?.id!

    try {
        const conversationId = req.params.conversationId;

        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const skip = (page - 1) * limit;

        logger.info({
            msg: "Fetching content",
            route: "/content/:conversationId",
            userId,
            conversationId,
            params: {
                page,
                limit
            }
        });

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
                editorProject: {
                    select: { id: true }
                },
                createdAt: true
            },
            orderBy: { createdAt: "asc" },
            skip: skip,
            take: limit
        });

        const totalCount = await prismaClient.video.count({
            where: { userId, conversationId }
        });
        const hasMore = skip + content.length < totalCount;

        logger.info({
            msg: "Found content items",
            route: "/content/:conversationId",
            userId,
            conversationId,
            items: content.length,
            params: {
                page,
                limit
            }
        });
        res.status(200).json({
            success: true,
            message: "Content fetched successfully",
            content,
            hasMore
        });
    } catch (error) {
        logger.error({
            msg: "Failed to fetch content",
            route: "/content/:conversationId",
            userId,
            conversationId: req.params.conversationId,
            error: error instanceof Error ? error.message : error
        });
        sendError(res, 500, "Failed to fetch content");
        return;
    }
});

contentRouter.delete("/conversation/:conversationId", async (req, res) => {
    const userId = req.user?.id!

    try {
        const conversationId = req.params.conversationId;

        if (!userId) {
            logger.warn({
                msg: "Unauthorized deleteConversation attempt",
                route: "/conversation/:conversationId"
            });
            return sendError(res, 401, "Unauthorized");
        }
        if (!conversationId) {
            logger.warn({
                msg: "Missing conversationId on deleteConversation",
                route: "/conversation/:conversationId",
                userId
            });
            return sendError(res, 400, "Missing conversationId");
        }

        const conversation = await prismaClient.conversation.delete({
            where: {
                id: conversationId,
                userId
            },
            select: {
                id: true,
                videos: {
                    select: {
                        id: true
                    }
                }
            }
        });

        const videoIds = conversation.videos.map(v => v.id);

        for (const videoId of videoIds) {
            const codeFilePath = `code/${videoId}.py`;
            try {
                await deleteFile(codeFilePath);
                logger.info({
                    msg: "Deleted code file",
                    videoId,
                    codeFilePath
                });
            } catch (err) {
                logger.error({
                    msg: "Failed to delete code file",
                    videoId,
                    codeFilePath,
                    error: err instanceof Error ? err.message : err
                });
            }

            const videoFolderPath = `videos/video_${videoId}`;
            try {
                await deleteFolder(videoFolderPath);
                logger.info({
                    msg: "Deleted video folder",
                    videoId,
                    videoFolderPath
                });
            } catch (err) {
                logger.error({
                    msg: "Failed to delete video folder",
                    videoId,
                    videoFolderPath,
                    error: err instanceof Error ? err.message : err
                });
            }
        }

        logger.info({
            msg: "Deleted conversation",
            route: "/conversation/:conversationId",
            conversationId,
            userId
        });
        res.status(200).json({ success:true, status: "success", message: "Conversation deleted" });
    } catch (error) {
        logger.error({
            msg: "Failed to delete conversation",
            route: "/conversation/:conversationId",
            conversationId: req.params?.conversationId ?? req.body?.conversationId,
            userId,
            error: error instanceof Error ? error.message : error
        });
        sendError(res, 500, "Failed to delete conversation");
    }
});

export default contentRouter;