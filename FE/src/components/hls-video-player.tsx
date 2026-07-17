import { useEffect, useRef, useState, memo } from "react"
import ReactHlsPlayer from "react-hls-player"
import type { ClipType } from "@/lib/types"
import { v4 as uuid } from "uuid"
import ErrorAlert from "./error-alert"
import { useAuth } from "@/hooks/use-Auth"

type HLSVideoPlayerProps = {
    id: string
    removeComponent?: () => void
    className?: string
    type: "preview" | "edit"
    draggable: boolean
}

function HLSVideoPlayerInner({ id, removeComponent, className, type, draggable }: HLSVideoPlayerProps) {
    const playerRef = useRef<HTMLVideoElement>(null)
    const { user } = useAuth()

    const [manifestUrl, setManifestUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function getManifestUrl() {
            try {
                setLoading(true);

                if (!user) {
                    throw new Error('No authentication token available');
                }
                const backendUrl = import.meta.env.VITE_BACKEND_URL;
                const url = `${backendUrl}/video/${id}/manifest?type=${type}`;

                if (!cancelled) setManifestUrl(url);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error && err.message ? ` ${err.message}` : "");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        getManifestUrl();

        return () => {
            cancelled = true
            if (playerRef.current) {
                playerRef.current.pause();
                playerRef.current.onended = null;
                playerRef.current.onerror = null;
                playerRef.current.src = '';
                playerRef.current.load();
                playerRef.current = null;
            }
        };
    
    }, [id, type]);


    function handleMouseEnter() {
        const video = playerRef.current
        if (video && video.readyState >= 2) {
            video.play().catch(() => {
            })
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
            const data: Required<ClipType> = {
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
            {manifestUrl && (
                <ReactHlsPlayer
                    draggable={draggable}
                    onDragStart={e => draggable && handleDrag(e)}
                    onMouseEnter={() => type === "edit" ? handleMouseEnter() : undefined}
                    onMouseLeave={() => type === "edit" ? handleMouseLeave() : undefined}
                    key={`player-${id}`}
                    playerRef={playerRef as React.RefObject<HTMLVideoElement>}
                    hlsConfig={{
                        xhrSetup: function (xhr: XMLHttpRequest, url: string) {
                            const URL = import.meta.env.VITE_BACKEND_URL;
                            if (URL && url.includes(URL)) {
                              xhr.withCredentials = true;
                            }
                          }
                    }}
                    src={manifestUrl}
                    controls={type === "preview"}
                    autoPlay={type === "preview"}
                    muted
                    onEnded={() => setTimeout(() => removeComponent?.(), 2000)}
                    onError={() => removeComponent?.()}
                    className={className}
                />
            )}
            
        </>
    )
}

export const HLSVideoPlayer = memo(HLSVideoPlayerInner)