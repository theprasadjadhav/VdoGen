import { useState } from "react";
import { AspectRatio } from "./ui/aspect-ratio";
import { IconPlayerPlay } from "@tabler/icons-react";
import { HLSVideoPlayer } from "./hls-video-player";


export function VideoHolder({ id }: {id:string}) {
    const [playingVideo, setPlayingVideo] = useState<boolean>(false);

    const removeComponent = () => {
        setPlayingVideo(false);
    };

    return (
        <div key={`video-container-${id}`}>
            <AspectRatio 
                ratio={16 / 9} 
                className={`flex items-center justify-center bg-muted rounded-lg overflow-hidden`}
            >
                {!playingVideo ? (
                    <IconPlayerPlay 
                        className="cursor-pointer" 
                        size={50} 
                        onClick={()=>setPlayingVideo(true)} 
                    />
                ) : (
                    <HLSVideoPlayer
                        id={id}
                        removeComponent={removeComponent}
                        className="w-full h-full"
                        type="preview"
                        draggable={false}
                    />
                )}
            </AspectRatio>
        </div>
    );
}