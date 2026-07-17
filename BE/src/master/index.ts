import express from "express";
import { logger } from "../util/config";
import cors from "cors"
import type { Request, Response, NextFunction } from 'express';
import projectRoute from "./routes/projectRouter";
import contentRouter from "./routes/contentRouter";
import videoRouter from "./routes/videoRouter";
import authRouter from "./routes/authRouter";
import { authMiddleware } from "./middlewares";
import cookieParser from "cookie-parser"
import { sendError } from "./functions";
import paymentRoute from "./routes/paymentRoute";
import { glovalLimiter } from "./rateLimiters";

const app = express()

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: corsOrigin, credentials:true }));

app.use(glovalLimiter)


app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info({
            msg: "HTTP request completed",
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        });
    });

    next();
});

app.use(cookieParser())

app.use("/v1/payment",paymentRoute)

app.use(express.json());

app.use("/v1/auth", authRouter)

app.use(authMiddleware)

app.use("/v1/video", videoRouter)
app.use("/v1/content", contentRouter)
app.use("/v1/project", projectRoute)


//default route
app.use((req, res) => {
    logger.warn({
        msg: "Route not found",
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
    });
    sendError(res,404,"Not Found")
})

//error handler route 
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error({
        msg: "Unhandled server error",
        error: err,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        stack: err.stack
    });
    sendError(res,500,"Internal server error")
})

const port = process.env.PORT || 8081;
app.listen(port, () => {
    logger.info({
        msg: "Master service started successfully",
        port: port,
        environment: process.env.NODE_ENV,
        pid: process.pid
    });
})
