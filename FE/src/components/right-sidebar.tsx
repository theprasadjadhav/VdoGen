import type { projectType } from "@/types"
import { HLSVideoPlayer } from "./hls-video-player"


export default function RightSidebar({ project }: { project: Required<projectType> }) {

    return (
        <aside className="flex w-full sm:h-full sm:w-32 p-1 sm:flex-col border-t sm:border-t-0 sm:border-l transition-all duration-300 group sm:hover:w-[240px]">
            <div className="flex flex-col items-center overflow-y-auto p-1 w-32 transition-all hover:w-48 sm:hover:w-full sm:w-full">
                {
                    project.videos.map(video =>
                        <HLSVideoPlayer
                            key={video.id}
                            id={String(video.id)}
                            className="rounded border"
                            type="edit"
                            draggable={true}
                        />
                    )
                }
                
            </div>
        </aside>
    )
}

