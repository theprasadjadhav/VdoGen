import { type NextFunction, type Request, type Response } from "express";
import { videoSpecsSchema } from "../util/zodSchemas";
import { prismaClient, logger, cookieOptions, JWT_SECRET } from "../util/config"
import { sendError } from "./functions";
import jwt  from 'jsonwebtoken';
import type { jwtType } from "../types";

export async function validateInputs(req: Request, res: Response, nxt: NextFunction) {
    try {
        const conversationId = req.body.conversationId;
        const prompt = req.body.prompt;
        const specs = req.body.specs;

        if (!specs || typeof specs !== "object") {
            logger.warn({
                msg: "Validation failed: Missing or invalid specs",
                method: req.method,
                url: req.originalUrl,
                specs: specs
            });
            return sendError(res, 400, "Bad Request: 'specs' is required and must be an object");
        }
        if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
            logger.warn({
                msg: "Validation failed: Missing or invalid prompt",
                method: req.method,
                url: req.originalUrl,
                prompt: prompt
            });
            return sendError(res, 400, "Bad Request: 'prompt' is required and must be a non-empty string");
        }
        if (conversationId !== undefined && typeof conversationId !== "string") {
            logger.warn({
                msg: "Validation failed: Invalid conversationId type",
                method: req.method,
                url: req.originalUrl,
                conversationId: conversationId
            });
            return sendError(res, 400, "Bad Request: 'conversationId' must be a string if provided");
        }

        const validatedSpecs = videoSpecsSchema.safeParse(specs);
        if (!validatedSpecs.success) {
            logger.warn({
                msg: "Validation failed: Specs validation failed",
                method: req.method,
                url: req.originalUrl,
                validationErrors: validatedSpecs.error?.errors
            });
            return sendError(res, 400, "Bad Request: Invalid 'specs' input");
        }

        if (conversationId && conversationId !== "" && conversationId !== "new") {
            const conversation = await prismaClient.conversation.findFirst({
                where: { id: conversationId },
            });
            if (conversation === null) {
                logger.warn({
                    msg: "Validation failed: Conversation does not exist",
                    method: req.method,
                    url: req.originalUrl,
                    conversationId: conversationId
                });
                return sendError(res, 400, "Bad Request: Conversation does not exist");
            }
        }

        logger.info({
            msg: "Input validation successful",
            method: req.method,
            url: req.originalUrl,
            conversationId: conversationId,
            promptLength: prompt?.length
        });

        return nxt();
    } catch (err) {
        logger.error({
            msg: "Unexpected error in validateInputs",
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined,
            method: req.method,
            url: req.originalUrl
        });
        return sendError(res, 500, "Internal Server Error");
    }
};

export async function authMiddleware(req: Request, res: Response, nxt: NextFunction) {
    try {
        const token = req.cookies?.token

       if(!token){
            logger.warn({
                msg: "Authentication failed: Invalid or missing token",
                method: req.method,
                url: req.originalUrl,
            });
            res.clearCookie("token", cookieOptions)
            return sendError(res, 401, "Unauthorized: Invalid or expired token");
       }


       let decoded: jwtType;
       try {
           decoded = jwt.verify(token, JWT_SECRET) as jwtType;
       } catch (err) {
           logger.warn({
               msg: "Authentication failed: Invalid or expired JWT",
               method: req.method,
               url: req.originalUrl,
               error: err instanceof Error ? err.message : err
           });
           res.clearCookie("token",cookieOptions)
           return sendError(res, 401, "Unauthorized: Invalid or expired token");
       }

       req.user = decoded.data 

        logger.info({
            msg: "Authentication successful",
            method: req.method,
            url: req.originalUrl,
            userId: req.user.id,
        });
        return nxt();

    } catch (err) {
        logger.error({
            msg: "Unexpected error in authentication",
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined,
            method: req.method,
            url: req.originalUrl
        });
        res.clearCookie("token",cookieOptions)
        return sendError(res, 500, "Internal Server Error");
    }
};