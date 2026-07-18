import type { Request, Response, NextFunction } from "express";
import { redis } from "../util/config";
import { sendError } from "./functions";

function createRateLimiter(options: {
    keyFn: (req: Request) => string;
    limit: number;
    windowSec: number;
    message: string;
}) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const key = `rl:${options.keyFn(req)}`;
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, options.windowSec);
        if (count > options.limit) {
            sendError(res, 429, options.message);
            return;
        }
        next();
    };
}

export const authLimiter = createRateLimiter({
    keyFn: (req) => `auth:${req.ip}`,
    limit: 10,
    windowSec: 15 * 60,  // 15 min
    message: "Too many attempts, try again in 15 minutes",
});

export const videoGenLimiter = createRateLimiter({
    keyFn: (req) => `videogen:${req.user?.id ?? req.ip}`,
    limit: 20,
    windowSec: 15 * 60,   // 15 min
    message: "Video generation limit reached, try again in 15 minutes",
});

export const paymentLimiter = createRateLimiter({
    keyFn: (req) => `payment:${req.ip}`,
    limit: 5,
    windowSec: 15 * 60,    // 15 min
    message: "Too many payment attempts, try again later",
});             

export const globalLimiter = createRateLimiter({
    keyFn: (req) => `global:${req.ip}`,
    limit: 100,
    windowSec: 60,    // 1 min
    message: "Too many requests, try again later",
});     