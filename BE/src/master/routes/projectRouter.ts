import { Router } from 'express';
import { logger, prismaClient, redis } from '../../util/config';
import { renderVideo, sendError } from '../functions';
import type { ProjectVideoArrayData } from '../../types';
import { ProjectVideoDataArraySchema } from '../../util/zodSchemas';
import { getSignedUrl } from '../../util/gcp';

const projectRouter = Router()

//get all projects
projectRouter.get("/", async (req, res) => {
    const userId = req.user?.id!
    try {

        const projects = await prismaClient.editorProject.findMany({
            where: { userId },
            select: { id: true, name: true }
        })

        logger.info({
            msg: "Projects fetched successfully",
            userId: userId,
            projectCount: projects.length
        });

        res.status(200).json({
            success: true,
            message: "Projects fetched successfully",
            projects
        })
    } catch (e) {
        logger.error({
            msg: "Failed to fetch projects",
            userId: userId,
            error: e instanceof Error ? e.message : e,
            stack: e instanceof Error ? e.stack : undefined
        });
        sendError(res, 500, "Failed to fetch Projects");
        return;
    }

})

//get one project with vidoes
projectRouter.get("/:projectId", async (req, res) => {
    const projectId = req.params.projectId
    const userId = req.user?.id!


    if (!projectId || projectId == "") {
        logger.warn({
            msg: "Invalid project ID provided",
            userId: userId,
            projectId: projectId
        });
        sendError(res, 400, "Bad Request: Invalid input")
        return
    }

    try {
        const project = await prismaClient.editorProject.findUnique({
            where: { id: projectId, userId },
            select: {
                id: true,
                name: true,
                data: true,
                videos: {
                    select: {
                        id: true
                    }
                }
            }
        });

        if (!project) {
            logger.warn({
                msg: "Project not found",
                userId: userId,
                projectId: projectId
            });
            sendError(res, 404, "Project Not Found")
            return
        }

        logger.info({
            msg: "Project fetched successfully",
            userId: userId,
            projectId: projectId,
            videoCount: project.videos.length
        });

        res.status(200).json({
            success: true,
            message: "Project fetched successfully",
            project
        })
    } catch (e) {
        logger.error({
            msg: "Failed to fetch project",
            userId: userId,
            projectId: projectId,
            error: e instanceof Error ? e.message : e,
            stack: e instanceof Error ? e.stack : undefined
        });
        sendError(res, 500, "Failed to fetch Project");
        return;
    }
})

//create project
projectRouter.post("/", async (req, res) => {
    const userId = req.user?.id!
    const projectName = req.body.projectName

    if (!projectName || projectName == "") {
        logger.warn({
            msg: "Invalid project name provided",
            userId: userId,
            projectName: projectName
        });
        sendError(res, 400, "Bad Request: 'project name' is required and must be a non-empty string")
        return
    }

    try {
        const data: ProjectVideoArrayData[] = []
        const project = await prismaClient.editorProject.create({
            data: {
                name: projectName,
                userId,
                data: JSON.stringify(data)
            },
            select: {
                id: true,
                name: true
            }
        })

        logger.info({
            msg: "Project created successfully",
            userId: userId,
            projectId: project.id,
            projectName: project.name
        });

        res.status(200).json({
            success: true,
            message: "Project created successfully",
            project
        })
    } catch (e) {
        logger.error({
            msg: "Failed to create project",
            userId: userId,
            projectName: projectName,
            error: e instanceof Error ? e.message : e,
            stack: e instanceof Error ? e.stack : undefined
        });
        sendError(res, 500, "Failed to create Project");
        return;
    }
})

//update project data
projectRouter.patch("/", async (req, res) => {
    const projectId = req.body.projectId
    const data = req.body.data
    const userId = req.user?.id!

    if (!projectId || projectId == "" || !data) {
        logger.warn({
            msg: "Invalid input for project update",
            userId: userId,
            projectId: projectId,
            data: data
        });
        sendError(res, 400, "Bad Request: Invalid input")
        return
    }

    const parsedDate = ProjectVideoDataArraySchema.safeParse(data)

    if (!parsedDate.success) {
        logger.warn({
            msg: "Failed schema validation for project data update",
            userId: userId,
            projectId: projectId,
            errors: parsedDate.error ? parsedDate.error.errors : "Unknown zod error"
        });
        sendError(res, 400, "Bad Request: Invalid input")
        return
    }

    try {
        const project = await prismaClient.editorProject.update({
            where: { id: projectId, userId },
            data: {
                data: JSON.stringify(parsedDate.data)
            }
        })
        logger.info({
            msg: "Project data updated successfully",
            userId: userId,
            projectId: projectId
        });
        res.status(200).json({
            success: true,
            message: "Project data updated successfully",
            project
        })
    } catch (e) {
        logger.error({
            msg: "Failed to update project data",
            userId: userId,
            projectId: projectId,
            error: e instanceof Error ? e.message : e,
            stack: e instanceof Error ? e.stack : undefined
        });
        sendError(res, 500, "Failed to fetch Project");
        return;
    }
})

//delete project
projectRouter.delete("/:projectId", async (req, res) => {
    const projectId = req.params.projectId
     const userId = req.user?.id!

    if (!projectId || projectId == "") {
        logger.warn({
            msg: "Invalid projectId provided for deletion",
            userId: userId,
            projectId: projectId
        });
        sendError(res, 400, "Bad Request: Invalid input")
        return
    }

    try {
        await prismaClient.editorProject.delete({
            where: { id: projectId, userId },
        })
        logger.info({
            msg: "Project deleted successfully",
            userId: userId,
            projectId: projectId
        });
        res.status(200).json({
            success: true,
            message: "Project deleted successfully"
        })
    } catch (e) {
        logger.error({
            msg: "Failed to delete project",
            userId: userId,
            projectId: projectId,
            error: e instanceof Error ? e.message : e,
            stack: e instanceof Error ? e.stack : undefined
        });
        sendError(res, 500, "Failed to delete project");
        return;
    }
})

//add videos to the project
projectRouter.post("/add-video", async (req, res) => {
    const projectIds = req.body.projectIds
    const videoId = req.body.videoId
     const userId = req.user?.id!

    if (!projectIds || !videoId || videoId == "" || !Array.isArray(projectIds)) {
        sendError(res, 400, "Bad Request: Invalid input")
        logger.warn({
            msg: "Invalid input for add-video",
            userId: userId,
            projectIds: projectIds,
            videoId: videoId
        });
        return
    }

    try {

        const video = await prismaClient.video.findUnique(
            { 
                where:{id:Number(videoId), userId}
            }
        )

        const projectCount = await prismaClient.editorProject.count({
            where:{
                id: {
                    in: projectIds
                },
                userId
            }
        })


        if(!video || projectCount!= projectIds.length){
            sendError(res, 400, "Bad Request: Invalid input")
            logger.warn({
                msg: "Invalid input for add-video",
                userId: userId,
                projectIds: projectIds,
                videoId: videoId
            });
            return
        }

        await prismaClient.$transaction(async (tx) => {

            await tx.$executeRawUnsafe(
                `DELETE FROM "_EditorProjectToVideo"
                WHERE "B" = $1
                `,
                Number(videoId)
            );
            logger.info({
                msg: "Removed video from all existing projects for this user",
                userId: userId,
                videoId: videoId
            });

            if (projectIds.length > 0) {
                const values = projectIds.map(id => `(${videoId}, '${id}')`).join(', ')
                await tx.$executeRawUnsafe(
                    `INSERT INTO "_EditorProjectToVideo" ("B", "A")
                     VALUES ${values}
                     ON CONFLICT DO NOTHING`
                )

                logger.info({
                    msg: "Added video to selected projects",
                    userId: userId,
                    videoId: videoId,
                    projectIds: projectIds
                });
            }
        })
        res.status(200).json({
            success: true,
            message: "Video has been successfully added to the selected project(s)."
        });

    } catch (e) {
        logger.error({
            msg: "Failed to add video to projects",
            userId: userId,
            videoId: videoId,
            projectIds: projectIds,
            error: e instanceof Error ? e.message : e,
            stack: e instanceof Error ? e.stack : undefined
        });
        sendError(res, 500, "Failed to add video to Projects")
    }
})

//render project video
projectRouter.post("/render", async (req, res) => {
    const projectId = req.query.projectId
     const userId = req.user?.id!

    if (!projectId) {
        logger.warn({
            msg: "Invalid project ID for render",
            userId: userId,
            projectId: projectId
        });
        sendError(res, 400, "Bad Request: Invalid input")
        return
    }

    const project = await prismaClient.editorProject.findFirst({
        where: {
            id: projectId as string,
            userId: userId
        }
    })

    if (!project) {
        logger.warn({
            msg: "Project not found for render",
            userId: userId,
            projectId: projectId
        });
        sendError(res, 400, "Bad Request: Invalid input")
        return
    }

    const jobId = `project-${project.id}`


    const jobStatus = await redis.get(jobId)

    if (jobStatus) {
        if (jobStatus === "error" || jobStatus === "complete") {
            logger.info({
                msg: "Clearing completed/errored job status",
                userId: userId,
                projectId: projectId,
                jobId: jobId,
                previousStatus: jobStatus
            });
            await redis.del(jobId)
        } else {
            logger.info({
                msg: "Render job already in progress",
                userId: userId,
                projectId: projectId,
                jobId: jobId,
                status: jobStatus
            });
            res.status(409).json({
                success: false,
                message: "Render job already in progress",
                jobId
            })
            return
        }
    }

    logger.info({
        msg: "Starting new render job",
        userId: userId,
        projectId: projectId,
        jobId: jobId,
        dataSize: project.data.length
    });

    redis.set(jobId, 0, "EX", 3600)

    renderVideo(project.data, jobId)

    res.status(200).json({
        success: true,
        message: "Render job started",
        jobId
    })
})

// check status of project video render
projectRouter.get("/render/status", async (req, res) => {

    try {
        const jobId = req.query.jobId

        if (!jobId || typeof (jobId) !== "string") {
            logger.warn({
                msg: "Invalid jobId for render status check",
                jobId: jobId
            });
            sendError(res, 400, "Bad Request: Invalid input")
            return
        }

        const status = await redis.get(jobId)

        if (!status) {
            logger.info({
                msg: "No status found for render job",
                jobId: jobId
            });
            res.status(200).json({
                success: true,
                message: "No status found for job",
                status: "error"
            })
        } else if (status === "complete") {
            const url = await getSignedUrl("project", `${jobId}.mp4`, 60)
            logger.info({
                msg: "Render job complete, returning signed url",
                jobId: jobId,
                url: url
            });
            res.status(200).json({
                success: true,
                message: "Render complete",
                status,
                url
            })
        } else {
            logger.info({
                msg: "Returning render job status",
                jobId: jobId,
                status: status
            });
            res.status(200).json({
                success: true,
                message: "Render in progress",
                status
            })
        }
    } catch (error) {
        logger.error({
            msg: "Error getting render status",
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
        })
        res.status(200).json({
            success: true,
            message: "Failed to get render status",
            status: "error"
        })
    }
})

export default projectRouter