import * as k8s from "@kubernetes/client-node";
import { PrismaClient } from "../../generated/prisma";
import Anthropic from "@anthropic-ai/sdk";
import Bull from "bull";
import Redis from "ioredis";
import type { JobData, StatusJobData } from "../types/types";
import { Storage } from "@google-cloud/storage";
import pino from 'pino';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Kubernetes Configuration
const kc = new k8s.KubeConfig();
try {
    kc.loadFromDefault(); // automatically loads from ~/.kube/config or service account in cluster
} catch (error) {
    throw new Error('Failed to initialize Kubernetes client');
}

export const k8sBatchClient = kc.makeApiClient(k8s.BatchV1Api);
export const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
export { kc, k8s };

// Prisma Configuration
export const prismaClient = new PrismaClient();

// Anthropic Configuration
export { Anthropic };
export const anthropic = new Anthropic();

// Google Cloud Storage Configuration
export const storage = new Storage();
export const bucketName = 'vdogen';

// Redis Configuration
const redisConfig = {
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    host: process.env.REDIS_URL,
    port: Number(process.env.REDIS_PORT) || 16799,
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3
};

// Initialize Redis client with error handling
let redis: Redis;
try {
    redis = new Redis(redisConfig);
    redis.on('error', (error) => {
        console.error('Redis connection error:', error);
    });
} catch (error) {
    console.error('Failed to initialize Redis client:', error);
    throw new Error('Failed to initialize Redis client');
}
export { redis };

// Job Queue Configuration
export const JobQueue = new Bull<JobData>('job-Queue', {
    redis: redisConfig,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true
    }
});

// Status Queue Configuration
export const StatusQueue = new Bull<StatusJobData>('Status-Queue', {
    redis: redisConfig,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true
    }
});


process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Closing connections...');
    await Promise.all([
        prismaClient.$disconnect(),
        redis.quit(),
        JobQueue.close(),
        StatusQueue.close()
    ]);
    process.exit(0);
});


// logger config

export const logger = {
    info: console.info,
    error: console.error,
    log:console.log
}

// const isProduction = process.env.NODE_ENV === 'production';
// let logger: pino.Logger;

// if (isProduction) {
//     const logDirectory = path.join(process.cwd(), 'logs');
//     const logFile = path.join(logDirectory, 'app.log');
//   logger = pino({
//     level: 'info',
//     formatters: {
//       level(label) {
//         return { level: label };
//       }
//     },
//     timestamp: pino.stdTimeFunctions.isoTime,
//     base: undefined, 
//   }, pino.destination({ dest: logFile, minLength: 4096, sync: false }));
// } else {
//   logger = pino({
//   level: 'debug',
//   timestamp: pino.stdTimeFunctions.isoTime,
// });
// }

// export { logger };