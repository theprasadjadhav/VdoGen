import {z} from "zod"

export const videoSpecsSchema = z.object({
    resolution: z.enum(["1080p","720p","480p","360p"]),
    fps: z.enum(["24","30","60"]),
    duration:z.enum(["5","10","15","30","60","120"]),
    aspectRatio:z.enum(["16:9","9:16","4:3"])
})



export const ProjectVideoDataArraySchema = z.array(z.object({
    id:z.string(),
    videoId: z.string(),
    url: z.string(),
    label: z.string(),
    startTime: z.number(),
    endTime: z.number(),
    timelineStartTime: z.number(),
    timelineEndTime: z.number()
}))

export const ProjectVideoDataSchema = z.object({
    id:z.string(),
    videoId: z.string(),
    url: z.string(),
    label: z.string(),
    startTime: z.number(),
    endTime: z.number(),
    timelineStartTime: z.number(),
    timelineEndTime: z.number()
})