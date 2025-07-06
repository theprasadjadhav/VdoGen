import type {  NextFunction,  Request,  Response } from "express";
import { videoSpecsSchema } from "../util/zodSchemas";
import { prismaClient, logger } from "../util/config"
import { sendError } from "./functions";

export async function validateInputs(req: Request, res: Response, nxt: NextFunction ){
    try {
        const conversationId = req.body.conversationId;
        const prompt = req.body.prompt;
        const specs = req.body.specs;

        if (!specs || typeof specs !== "object") {
            logger.error("Missing or invalid specs");
            return sendError(res, 400, "Bad Request: 'specs' is required and must be an object");
        }
        if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
            logger.error("Missing or invalid prompt");
            return sendError(res, 400, "Bad Request: 'prompt' is required and must be a non-empty string");
        }
        if (conversationId !== undefined && typeof conversationId !== "string") {
            logger.error("Invalid conversationId type");
            return sendError(res, 400, "Bad Request: 'conversationId' must be a string if provided");
        }

        const validatedSpecs = videoSpecsSchema.safeParse(specs);
        if (!validatedSpecs.success) {
            logger.error("Specs validation failed");
            return sendError(res, 400, "Bad Request: Invalid 'specs' input");
        }

        if (conversationId && conversationId !== "" && conversationId !== "new" ) {
            const conversation = await prismaClient.conversation.findFirst({
                where: { id: conversationId },
            });
            if (conversation === null) {
                logger.error("Conversation does not exist");
                return sendError(res, 400, "Bad Request: Conversation does not exist");
            }
        }
        return nxt();
    } catch (err) {
        logger.error("Unexpected error in validateInputs", err);
        return sendError(res, 500, "Internal Server Error");
    }
};

export function authMiddleware(req: Request, res: Response, nxt: NextFunction ){
    if (!req.auth?.userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    return nxt();
};