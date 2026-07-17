import { memo } from "react"
import type { ProjectType } from "@/lib/types"
import { HLSVideoPlayer } from "./hls-video-player"


function RightSidebar({ project }: { project: Required<ProjectType> }) {

    return (
        <aside className="flex w-full sm:h-full p-1 border-t sm:border-t-0 sm:border-l transition-all duration-300 group sm:w-32 sm:flex-col sm:hover:w-[240px] min-h-[120px]">
            <div className="flex flex-row sm:flex-col items-center gap-2 overflow-y-auto p-1 w-full min-h-[120px] sm:h-full">
                {
                    project.videos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center w-full h-full py-8 text-center text-muted-foreground">
                            <span className="text-sm font-medium">No videos yet.</span>
                            <span className="text-xs mt-2">Add a video from the conversation to get started.</span>
                        </div>
                    ) : (
                        <>
                            {project.videos.map(video =>
                                <HLSVideoPlayer
                                    key={video.id}
                                    id={String(video.id)}
                                    className="rounded border w-32 hover:w-[240px] sm:w-full"
                                    type="edit"
                                    draggable={true}
                                />
                            )}
                        <div className="w-full flex items-center justify-center py-2">
                            <span className="text-xs text-muted-foreground">Drag a video to the timeline to add it.</span>
                        </div>
                        </>
                        
                    )

                }
            </div>
        </aside >
    )
}

export default memo(RightSidebar)

