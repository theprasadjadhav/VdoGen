import { useRef, useEffect, useState } from "react";
import { useAuth } from '@clerk/clerk-react';
import { baseAxios } from '@/lib/axios';
import type { Clip, projectType } from '@/types';
import { Button } from './ui/button';
import { IconChevronLeft, IconCircleCheck, IconDownload, IconEditCircle, IconPlayerPause, IconPlayerPlay, IconReload } from '@tabler/icons-react';
import Hls from 'hls.js';
import TimelineEditor from './TimelineEditor';
import RightSidebar from './right-sidebar';
import { Progress } from "./ui/progress";
import { toast } from "sonner";
import { ConfirmationDialog } from "./ui/confirmation-dialog";
import EditorSkeleton from "./skeleton/editor-skeleton";
import ErrorAlert from "./error-alert";
import { Spinner } from "./ui/spinner";

type EditorPropsType = {
    selectedProject: string,
    setSelectedProject: React.Dispatch<React.SetStateAction<string | null>>
}

export default function Editor({ selectedProject, setSelectedProject }: EditorPropsType) {

    const { getToken } = useAuth()

    const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
    const hlsPlayerRefs = useRef<Record<string, Hls | null>>({})
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const hlsRef = useRef<Hls | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState<boolean>(true)
    const [saving, setSaving] = useState<boolean>(false)
    const [videoIds, setVideoIds] = useState<string[] | null>(null)
    const [timelinecurrentTime, setTimelineCurrentTime] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(isPlaying)
    const [currentClip, setCurrentClip] = useState<Clip | null>()
    const [clips, setClips] = useState<Required<Clip>[]>([])
    const [renderProgess, setRenderProgess] = useState<null | string>(null)
    const [project, setProject] = useState<Required<projectType> | null>(null)
    const [playDisabled, setPlayDisabled] = useState(false)


    async function startRender() {
        try {
            const token = await getToken()

            if (!token) {
                toast.error("No authentication token available")
                return
            }

            const res = await baseAxios.post(`/project/render?projectId=${selectedProject}`, {}, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            if (res.status == 200 || res.status == 409) {

                if (res.status == 409) {
                    toast.info("render already inprogess")
                }

                const jobId = res.data.jobId
                let status = "0"
                setRenderProgess(status)

                while (status != "complete" && status != "error") {
                    const token = await getToken()
                    const res = await baseAxios.get(`/project/render/status?jobId=${jobId}`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    })

                    if (res.status == 200) {
                        const resStatus = res.data.status

                        if (resStatus == "error") {
                            status = "error"
                        } else if (resStatus == "complete") {
                            status = resStatus

                            const response = await fetch(res.data.url, { method: "GET" });
                            if (!response.ok) throw new Error("Failed to fetch video");

                            const blob = await response.blob()
                            const blobUrl = URL.createObjectURL(blob)
                            const a = document.createElement("a")
                            a.href = blobUrl;
                            a.download = "video.mp4";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(blobUrl)
                        } else {
                            status = resStatus
                            setRenderProgess(resStatus)
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }
                    } else {
                        status = "error"
                    }
                }
                setRenderProgess(null)
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "An error occurred while rendering the video. Please try again."
            toast.error(message);
        }
    }

    async function getManifestFileAndCreateBlob(videoId: string): Promise<[string, null] | [null, string]> {

        const token = await getToken()

        if (!token) {
            return [null, "No authentication token available"]
        }

        try {
            const response = await baseAxios.get(`/video/${videoId}/manifest?token=${token}&type=edit`)
            if (response.status != 200) {
                return [null, "Unable to load video: Internal server error"]
            }

            const manifestBlob = new Blob([response.data], { type: 'application/vnd.apple.mpegurl' })
            const manifestBlobUrl = URL.createObjectURL(manifestBlob)
            return [manifestBlobUrl, null]
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "unexpected error unable to get video"
            return [null, errorMessage]
        }
    }

    // async function getClipsWithUrl(clips: Required<Clip>[]): Promise<Required<Clip>[]> {

    //     const token = await getToken()

    //     if (!token) {
    //         toast.info("No authentication token available. Please login to continue.");            
    //         return [];
    //     }
    //     const modifiedClips = await Promise.all(
    //         clips.map(async clip => {
    //             const [url, error] = await getManifestFileAndCreateBlob(clip.videoId,token);
    //             if (url) {
    //                 return { ...clip, url };
    //             } else {
    //                 toast.info(`Clip ${clip.label} is removed from timeline due to: ${error}`)
    //                 setSaved(false)
    //                 return null;
    //             }
    //         })
    //     );
    //     const filteredClips = modifiedClips.filter(clip => clip != null);
    //     return filteredClips;
    // }

    async function saveProjectData() {
        setSaving(true)
        const token = await getToken()

        try {
            if (!token) {
                setSaving(false)
                toast.error("No authentication token available")
                return
            }
            const response = baseAxios.patch("/project",
                {
                    projectId: selectedProject,
                    data: clips
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            toast.promise(response.then(res => {
                if (res.status === 200) {
                    return res;
                } else {
                    throw new Error();
                }
            }), {
                loading: 'Saving...',
                success: () => {
                    setSaved(true)
                    setSaving(false)
                    return `Project Saved successfully`
                },
                error: () => {
                    setSaving(false)
                    return 'Error Saving Project'
                }
            })

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to save project data";
            toast.error(errorMessage)
            setSaving(false)
            return;
        }
    }

    const handlePlayheadDrag = (dropTime: number) => {
        setIsPlaying(false)
        setCurrentClip(null)
        setTimelineCurrentTime(dropTime)
    }

    useEffect(() => {
        async function getProjectData() {
            setLoading(true)
            try {
                const token = await getToken()

                if (!token) {
                    throw new Error("No authentication token available")
                }

                const response = await baseAxios.get(`/project/${selectedProject}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if (response.status != 200) {
                    throw new Error("Internal server error: Failed to fetch Project")
                }

                const project: Required<projectType> = response.data

                setProject(project)

                const clips: Required<Clip>[] = JSON.parse(project.data)

                if (!clips) {
                    throw new Error("failed to featch project data")
                }
                //const modifiedClips = await getClipsWithUrl(clips)

                setClips(clips)
                setVideoIds(Array.from(new Set(clips.map(c => c.videoId))))
                setError(null)

            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : "Failed to fetch Project Data"
                setError(errorMessage)
            } finally {
                setLoading(false)
            }
        }

        getProjectData()

        return () => {
            Object.entries(hlsPlayerRefs.current).forEach(hlsPayer => {
                if (hlsPayer[1]) {
                    hlsPayer[1].destroy()
                }
            })
        }
    }, []);


    useEffect(() => {
        let cancelled = false

        async function initPlayersWhenRefsReady() {
            setPlayDisabled(true)
            if (!videoIds || videoIds.length === 0) return

            const maxAttempts = 50
            let attempts = 0
            while (!cancelled && attempts < maxAttempts) {
                const allReady = videoIds.every(id => !!videoRefs.current[id])
                if (allReady) break
                await new Promise(res => setTimeout(res, 100))
                attempts += 1
            }
            if (cancelled) return

            for (const videoId of videoIds) {
                if (cancelled) return

                const existingHls = hlsPlayerRefs.current[videoId]
                if (existingHls) continue

                const [videoUrl, error] = await getManifestFileAndCreateBlob(videoId)
                if (!videoUrl) {
                    toast.error(error)
                    setSaved(false)
                    setLoading(false)
                    continue
                }

                const videoRef = videoRefs.current[videoId]
                if (!videoRef) continue

                if (Hls.isSupported()) {
                    const hls = new Hls()
                    hlsPlayerRefs.current[videoId] = hls
                    hls.attachMedia(videoRef)
                    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                        hls.loadSource(videoUrl)
                    })
                } else if (videoRef.canPlayType('application/vnd.apple.mpegurl')) {
                    videoRef.src = videoUrl
                }
            }

            await Promise.all(
                Object.entries(hlsPlayerRefs.current).map(([, hlsRef]) => {
                    return new Promise<void>((resolve) => {
                        const manifestLoadedhandler = () => {
                            hlsRef?.off(Hls.Events.FRAG_BUFFERED, manifestLoadedhandler)
                            resolve()
                        }
                        hlsRef?.on(Hls.Events.FRAG_BUFFERED, manifestLoadedhandler)
                    })

                })
            ).then(() => {
                setPlayDisabled(false)
            })
        }

        initPlayersWhenRefsReady()

        return () => {
            cancelled = true
        }
    }, [videoIds])

    useEffect(() => {
        isPlayingRef.current = isPlaying
        let intervalId: NodeJS.Timeout | null = null;

        if (isPlaying) {
            if (videoRef.current && hlsRef.current) {
                videoRef.current.play()
            }
            intervalId = setInterval(() => {
                setTimelineCurrentTime(prev => prev + 1 / 24);
            }, 1000 / 24)
        } else {
            if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
            }
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isPlaying]);

    useEffect(() => {
        if (!Array.isArray(clips) || clips.length === 0) return;

        const lastClip = clips[clips.length - 1];
        // Pause and clean up if timeline passes last clip
        if (timelinecurrentTime >= lastClip.timelineEndTime) {
            setIsPlaying(false);
            if (videoRef.current) {
                videoRef.current.pause();
            }
            hlsRef.current = null;
            videoRef.current = null;
            return;
        }

        // Find the clip that matches the current timeline time
        const newCurrentClip = clips.find(
            clip =>
                timelinecurrentTime >= clip.timelineStartTime &&
                timelinecurrentTime <= clip.timelineEndTime
        );

        // If we have a current clip but none matches now, clean up
        if (currentClip && !newCurrentClip) {
            if (videoRef.current) {
                videoRef.current.pause();
            }
            hlsRef.current = null;
            videoRef.current = null;
            setCurrentClip(null);
            return;
        }

        // If there's no new clip, do nothing
        if (!newCurrentClip) return;

        // If changing clips or no clip is selected yet
        if (!currentClip || newCurrentClip.id !== currentClip.id) {
            const newHlsRef = hlsPlayerRefs.current[newCurrentClip.videoId] ?? null;
            const newVideoRef = videoRefs.current[newCurrentClip.videoId] ?? null;

            if (!newHlsRef || !newVideoRef) return;

            hlsRef.current = newHlsRef;
            videoRef.current = newVideoRef;

            // Calculate correct currentTime for new clip
            videoRef.current.currentTime =
                newCurrentClip.startTime +
                (timelinecurrentTime - newCurrentClip.timelineStartTime);

            if (isPlayingRef.current) {
                videoRef.current.play();
            }

            setCurrentClip(newCurrentClip);
        }
    }, [timelinecurrentTime, clips, currentClip]);

    if (loading) {
        return <EditorSkeleton />
    }
    if (error) {
        return (
            <div className="flex flex-col h-full w-full">
                <Button
                    className='flex items-center justify-start gap-2 p-2  mt-10 ml-4 mr-auto text-muted-foreground hover:text-primary'
                    variant={"ghost"}
                    onClick={() => {
                        setSelectedProject("")
                    }}
                >
                    <IconChevronLeft />
                    <span className="text-base font-medium">Back To Projects</span>
                </Button>
                <ErrorAlert message="ops! We couldn't load editor. Please try again in a moment." />
            </div>
        )
    }

    return (
        <div className="flex flex-col sm:flex-row flex-1 h-full w-full py-2  bg-gradient-to-br from-background to-muted/60">

            {/* main editor */}
            <div className='flex flex-1 flex-col justify-center p-8 w-full'>

                {/* back, save, download */}
                <div className='flex justify-between'>
                    {/* back button */}
                    {saved ?
                        <Button
                            className='flex items-center gap-2 text-muted-foreground hover:text-primary'
                            variant={"ghost"}
                            onClick={() => {
                                setSelectedProject("")
                            }}
                        >
                            <IconChevronLeft />
                            <span className="hidden sm:block text-base font-medium">Back To Projects</span>
                        </Button>
                        :
                        <ConfirmationDialog
                            trigger={
                                <Button
                                    className='flex items-center gap-2 text-muted-foreground hover:text-primary'
                                    variant={"ghost"}
                                >
                                    <IconChevronLeft />
                                    <span className="text-base font-medium">Back To Projects</span>
                                </Button>
                            }
                            title="Back to Projects"
                            description="You have unsaved changes. If you go back now, any changes you made will be lost. Do you want to continue?"
                            onConfirm={() => setSelectedProject("")}

                        />
                    }

                    {/* save & download button */}
                    <div className='flex gap-2 justify-center items-center'>

                        {/* download button and render progress */}
                        <div className="relative">

                            <Button
                                variant={"outline"}
                                size={"icon"}
                                onClick={() => {
                                    if (!saved) {
                                        toast.warning("Please save your project before downloading.");
                                        return;
                                    }
                                    setRenderProgess("0")
                                    startRender()
                                }}
                                disabled={!!renderProgess || clips.length == 0}
                            >
                                <IconDownload />
                            </Button>
                            {renderProgess &&
                                <div className="absolute left-1/2 -translate-x-1/2 mt-2 z-10 bg-popover border border-border rounded-lg shadow-lg px-4 py-3 flex flex-col items-center w-48">
                                    <Progress value={Number(renderProgess)} className="my-2"></Progress>
                                    <p className="text-sm font-medium">{Math.floor(Number(renderProgess))}%</p>
                                    <span className="text-xs text-muted-foreground mt-1">Rendering...</span>
                                </div>
                            }
                        </div>

                        {/* save button */}
                        <Button
                            variant={"outline"}
                            disabled={saving}
                            onClick={() => {
                                saveProjectData()
                            }}
                        >
                            Save{saved ? <IconCircleCheck color='green' /> : <IconEditCircle />}
                        </Button>


                    </div>
                </div>

                {/* video player, play/pause and restart button */}
                <div className='flex flex-col gap-2 justify-center items-center h-[75%]'>

                    {/* video player holder */}
                    <div className="w-full md:w-3/5 h-auto aspect-video bg-black">
                        {
                            videoIds?.map(videoId => (


                                <video
                                    key={videoId}
                                    ref={(el) => {
                                        videoRefs.current[videoId] = el;
                                    }}
                                    muted
                                    style={{
                                        display: (currentClip && currentClip.videoId === videoId) ? "block" : "none",
                                        width: "100%",
                                    }}
                                />
                            ))
                        }

                        {/* spinner */}
                        {playDisabled &&
                            <div className="w-full h-full">
                                <div className="flex justify-center items-center h-full">
                                    <Spinner />
                                </div>
                            </div>
                        }
                    </div>

                    {/* play/pause and restart button */}
                    <div>
                        {/* play/pause button */}
                        <Button
                            onClick={() => {
                                setIsPlaying(pre => {
                                    return !pre;
                                });
                            }}
                            size={"icon"}
                            variant={"ghost"}
                            disabled={playDisabled || clips.length == 0 || timelinecurrentTime >= clips[clips.length - 1].timelineEndTime}
                        // disabled={playDisabled}
                        >
                            {isPlaying ? <IconPlayerPause /> : <IconPlayerPlay />}
                        </Button>

                        {/* restart button */}
                        <Button
                            onClick={() => {
                                setTimelineCurrentTime(0)
                                setCurrentClip(null)
                            }}
                            size={"icon"}
                            variant={"ghost"}
                            disabled={clips.length == 0 || isPlaying}
                        >
                            {<IconReload />}
                        </Button>
                    </div>
                </div>


                {/* timeline component */}
                <TimelineEditor
                    isPlaying={isPlaying}
                    handlePlayheadDrag={handlePlayheadDrag}
                    timelinecurrentTime={timelinecurrentTime}
                    clips={clips}
                    setClips={setClips}
                    getManifestFileAndCreateBlob={getManifestFileAndCreateBlob}
                    setSaved={setSaved}
                    setCurrentClip={setCurrentClip}
                />
            </div>

            {/* sidebar */}
            {project && <RightSidebar project={project} />}
        </div>
    )
}