import type { z } from "zod";
import { type videoSpecsSchema, ProjectVideoDataArraySchema, ProjectVideoDataSchema } from "../util/zodSchemas";

export enum videoStatusEnum{
    INITIATED = "Initiated",
    FAILED = "Failed to create video",
    INVALID_PROMPT = "Invalid Prompt provided",
    COMPLETE = "Complete",
    PROCESSING = "Processing",
    ERROR = "Error while proccessing your request" 
}

export const resolutionMap: Record<AspectRatioType, Record<ResolutionType, { width: number; height: number }>> = {
    '16:9': {
      '360p': { width: 640, height: 360 },
      '480p': { width: 854, height: 480 },
      '720p': { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 },
    },
    '9:16': {
      '360p': { width: 360, height: 640 },
      '480p': { width: 480, height: 854 },
      '720p': { width: 720, height: 1280 },
      '1080p': { width: 1080, height: 1920 },
    },
    '4:3': {
      '360p': { width: 480, height: 360 },
      '480p': { width: 640, height: 480 },
      '720p': { width: 960, height: 720 },
      '1080p': { width: 1440, height: 1080 },
    }
  }

export type VideoSpecsType = z.infer<typeof videoSpecsSchema>
export type ProjectVideoArrayData = z.infer<typeof ProjectVideoDataArraySchema>
export type ProjectVideoData = z.infer<typeof ProjectVideoDataSchema>


export type AspectRatioType = '16:9' | '9:16' | '4:3';
export type ResolutionType = '360p' | '480p' | '720p' | '1080p';

export type JobData = {
    id:number;
    prompt: string;
    specs: VideoSpecsType;
    conversationId: string;
    userId: string;
    retry: number,
    isFailed?:boolean
}

export type JobResponse = {
    status: videoStatusEnum;
    message: string;
    conversationId: string;
    id:number;
    jobName?:string;
}

export type jwtType = {
    data: {
        id: string;
        name: string;
        email: string | null;
        useCount: number;
        primeExpiry: Date | null;
        avatarUrl: string | null;
    };
    iat: number;
    exp: number;
}
