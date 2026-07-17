import z from "zod";

export const loginSchema = z.object({
    email: z.string().email("Enter a valid email."),
    password: z.string().min(1, "Password is required."),
});

export const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please re-enter your password."),
}).refine((val) => val.password === val.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});

export const AddVideoToProjectFormSchema = z.object({
    projectIds: z.array(z.string())
});

export const videoSpecsSchema = z.object({
    resolution: z.enum(["1080p", "720p", "480p", "360p", ""]),
    fps: z.enum(["24", "30", "60", ""]),
    duration: z.enum(["5", "10", "15", "30", "60", "120", ""]),
    aspectRatio: z.enum(["16:9", "9:16", "4:3", ""])
})

export const VideoGenFormSchema = z.object({
    prompt: z.string(),
    specs: videoSpecsSchema
})

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please re-enter your password."),
}).refine((val) => val.newPassword === val.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});