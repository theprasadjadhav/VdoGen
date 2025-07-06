import type { z } from "zod";
import type { videoSpecsSchema } from "../util/zodSchemas";
import { videoStatusEnum } from "../util/enums";

export type VideoSpecsType = z.infer<typeof videoSpecsSchema>

export type AspectRatioType = '16:9' | '9:16' | '4:3';
export type ResolutionType = '360p' | '480p' | '720p' | '1080p';

export type JobData = {
    id:number;
    prompt: string;
    specs: VideoSpecsType;
    conversationId: string;
    userId: string;
}

export type JobResponse = {
    status: videoStatusEnum;
    message: string;
    conversationId: string;
    id:number;
    jobName?:string;
}

export type StatusJobData = {
    k8sJobName:string;
    id:number;
    conversationId:string;
    specs:VideoSpecsType;
    userId:string

}