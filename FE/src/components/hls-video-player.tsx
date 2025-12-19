import { useEffect, useRef, useState } from "react"
import ReactHlsPlayer from "react-hls-player"
import { useAuth } from "@clerk/clerk-react"
import type { Clip } from "@/types"
import { v4 as uuid } from "uuid"
import ErrorAlert from "./error-alert"
import { toast } from "sonner"

type HLSVideoPlayerProps = {
    id: string
    removeComponent?: () => void
    className?: string
    type: "preview" | "edit"
    draggable: boolean
}

export function HLSVideoPlayer({ id, removeComponent, className, type, draggable }: HLSVideoPlayerProps) {
    const playerRef = useRef<HTMLVideoElement>(null)
    const { getToken } = useAuth()

    const [manifestUrl, setManifestUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function getManifestUrl() {
            try {
                setLoading(true);

                const token = await getToken({ template: "manifest-file-Template" });

                if (!token) {
                    toast.error("No authentication token available. Please login to continue.");
                }

                const backendUrl = import.meta.env.VITE_BACKEND_URL;

                const url = `${backendUrl}/video/${id}/manifest?token=${token}&type=${type}`;

                setManifestUrl(url);
            } catch (err) {
                setError(err instanceof Error && err.message ? ` ${err.message}` : "");
            } finally {
                setLoading(false);
            }
        }

        getManifestUrl();

        return () => {
            if (playerRef.current) {
                playerRef.current.pause();
                playerRef.current.onended = null;
                playerRef.current.onerror = null;
                playerRef.current.src = '';
                playerRef.current.load();
                playerRef.current = null;
            }
        };
    }, []);


    function handleMouseEnter() {
        if (playerRef.current) {
            playerRef.current.play()
        }
    }

    function handleMouseLeave() {
        if (playerRef.current) {
            playerRef.current.pause()
            playerRef.current.currentTime = 0
        }
    }

    function handleDrag(e: React.DragEvent<HTMLVideoElement>) {
        if (playerRef.current) {
            const data: Required<Clip> = {
                id: uuid(),
                videoId: id,
                startTime: 0,
                endTime: playerRef.current.duration,
                label: "",
                url: "",
                timelineEndTime: 0,
                timelineStartTime: 0

            }
            e.dataTransfer.setData("text/json", JSON.stringify(data))
        }
    }

    if (loading) {
        return (
            <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-t-transparent border-gray-400 rounded-full animate-spin"></span>
            </span>
        )
    }
    if (error) {
        return <ErrorAlert message="Unable to load video" />
    }


    return (
        <>
            { manifestUrl && <ReactHlsPlayer
                draggable={draggable}
                onDragStart={(e) => draggable && handleDrag(e)}
                onMouseEnter={() => type == "edit" ? handleMouseEnter() : undefined}
                onMouseLeave={() => type == "edit" ? handleMouseLeave() : undefined}
                key={`player-${id}`}
                playerRef={playerRef as React.RefObject<HTMLVideoElement>}
                src={manifestUrl}
                controls={type == "preview" ? true : false}
                autoPlay={type == "preview" ? true : false}
                muted
                onEnded={() => setTimeout(() => removeComponent?.(), 2000)}
                onError={()=> removeComponent?.()}
                className={className}/>
            }
        </>
    )
}