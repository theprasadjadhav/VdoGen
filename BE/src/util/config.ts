import * as k8s from "@kubernetes/client-node";
import { PrismaClient } from "../../generated/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { Queue } from "bullmq";
import IORedis, { Redis, type RedisOptions } from 'ioredis';
import type { JobData } from "../types";
import { Storage } from "@google-cloud/storage";
import pino from "pino";
import path from "path";
import Razorpay from "razorpay";
import type { CookieOptions } from "express";

const isProduction = process.env.NODE_ENV === 'production';

const requiredEnvVars = [                                                                                                                                      
    "JWT_SECRET",                                                                                                                                              
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",                                                                                                                                     
    "RAZORPAY_WEBHOOK_SECRET",
    "DEEPSEEK_API_KEY",                                                                                                                                        
    "REDIS_URL",
];                                                                                                                                                             
                                                                                                                                                               
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {                                                                                                                                
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);                                                                                                                                       
    }
}  

export const JWT_SECRET = process.env.JWT_SECRET!;

let logger: pino.Logger;

if (isProduction) {
    logger = pino({
        level: 'info',
        formatters: {
            level(label) {
                return { level: label };
            }
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        serializers: {
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res,
            err: pino.stdSerializers.err
        }
    })
} else {
    logger = pino({
        level: 'debug',
        timestamp: pino.stdTimeFunctions.isoTime,
        serializers: {
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res,
            err: pino.stdSerializers.err
        }
    })
}

export { logger };

//Kubernetes Configuration
const kc = new k8s.KubeConfig();
try {
    logger.info({ msg: 'Initializing Kubernetes client from cluster' });
    kc.loadFromCluster();
} catch (error) {
    logger.error({ msg: 'Failed to initialize Kubernetes client from cluster ', error: error });

    try {
        logger.info({ msg: 'Falling back to default KubeConfig' });
        kc.loadFromDefault();
    } catch (error) {
        logger.error({ msg: 'Failed to initialize Kubernetes client', error: error });
        throw new Error('Failed to initialize Kubernetes client');
    }
}

const k8sBatchClient = kc.makeApiClient(k8s.BatchV1Api);
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const watch = new k8s.Watch(kc);
const namespace =  process.env.K8S_NAMESPACE ?? "vdogen"
export { kc, k8s, k8sBatchClient, k8sApi, watch, namespace };


// Prisma Configuration
export const prismaClient = new PrismaClient();


// Anthropic Configuration
export { Anthropic };
export const anthropic = new Anthropic({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: "https://api.deepseek.com/anthropic",
  });;

// Google Cloud Storage Configuration
export const storage = new Storage();
export const bucketName =  process.env.K8S_NAMESPACE ?? "vdogen"

// Redis Configuration
const redisConfig:RedisOptions = {
    username: process.env.REDIS_USERNAME || "",
    password: process.env.REDIS_PASSWORD || "",
    host: process.env.REDIS_URL,
    port: Number(process.env.REDIS_PORT) || 6379,
    // tls: process.env.NODE_ENV === "production" ? {} : undefined,
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 3000);
        return delay;
    },
    maxRetriesPerRequest: null
};



let redis: Redis;
try {
    redis = new IORedis(redisConfig);
    redis.on('error', (error) => {
        logger.error({ 
            msg: 'Redis connection error', 
            error: error.message,
            stack: error.stack 
        });
    });
    redis.on('connect', () => {
        logger.info({ 
            msg: 'Redis client connected',
            usingConnectionString: typeof redisConfig === 'string'
        });
    });
    redis.on('ready', () => {
        logger.info({ msg: 'Redis client ready' });
    });
    redis.on('close', () => {
        logger.warn({ msg: 'Redis connection closed' });
    });
} catch (error) {
    logger.error({ 
        msg: 'Failed to initialize Redis client', 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error('Failed to initialize Redis client');
}

export { redis, redisConfig }


//Job Queue Configuration
export const JobQueue = new Queue<JobData>('Job-Queue', {
    connection: redisConfig,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true
    }
});

export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


export const cookieOptions:CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
};




process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM. Closing connections...');
    await Promise.all([
        prismaClient.$disconnect(),
        redis.quit(),
        JobQueue.close()
    ]);
    process.exit(0);
});