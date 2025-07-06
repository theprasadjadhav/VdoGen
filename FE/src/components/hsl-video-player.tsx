import { useEffect, useRef, useState } from "react";
import ReactHlsPlayer from "react-hls-player";
import { useAuth } from "@clerk/clerk-react";

type HLSVideoPlayerProps = {
    id: string;
    removeComponent: () => void;
    className?: string;
}

export function HLSVideoPlayer({ id, removeComponent, className }: HLSVideoPlayerProps) {
    const playerRef = useRef<HTMLVideoElement>(null);
    const { getToken } = useAuth();

    const [manifestUrl, setManifestUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function getManifestUrl() {
            try {
                setLoading(true);
                const token = await getToken({ template: "manifest-file-Template" });
                
                if (!token) {
                    throw new Error("No authentication token available");
                }

                const url = `http://localhost:8081/video/${id}/manifest?token=${token}`;
                setManifestUrl(url);
                setError(null);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch content';
                setError(errorMessage);
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
            removeComponent();
        };
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }
    if (error) {
        return <div>Error: {error}</div>;
    }
    if (!manifestUrl) {
        return null;
    }

    return (
        <ReactHlsPlayer
            key={`player-${id}`}
            playerRef={playerRef as React.RefObject<HTMLVideoElement>}
            src={manifestUrl}
            controls={true}
            autoPlay={true}
            muted={false}
            onEnded={() => setTimeout(() => removeComponent(), 2000)}
            onError={() => removeComponent()}
            className={className}
        />
    );
}