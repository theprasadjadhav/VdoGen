import {z} from "zod"

export const videoSpecsSchema = z.object({
    resolution: z.enum(["1080p","720p","480p","360p"]),
    fps: z.enum(["24","30","60"]),
    duration:z.enum(["5","10","15","30","60","120"]),
    aspectRatio:z.enum(["16:9","9:16","4:3"])
})


