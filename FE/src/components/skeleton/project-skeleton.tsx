import { Skeleton } from "@/components/ui/skeleton"
import { Fragment } from "react"

export function ProjectSkeleton() {
    return (
        <div className="h-full w-full flex flex-col">
            {/* Header skeleton */}
            <div className="border-b">
                <div className="h-16 flex items-center gap-4 px-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-20" />
                    <div className="ml-auto flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded" />
                    </div>
                </div>
            </div>

            {/* Page content skeleton */}
            <div className="bg-gradient-to-br from-background to-muted/60 py-12 px-4 grow">
                {/* Back button row */}
                <div className="flex justify-between items-center mb-10">
                    <Skeleton className="h-9 w-40" />
                </div>

                {/* Title and subtitle */}
                <div className="flex flex-col items-center mb-12">
                    <Skeleton className="h-10 w-72 mb-3" />
                    <Skeleton className="h-4 w-96 mb-3" />
                    <div className="flex items-center mb-3">
                        <Skeleton className="h-4 w-56 mr-2" />
                        <Skeleton className="h-4 w-86" />
                    </div>
                </div>

                {/* Projects grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto justify-items-center">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Fragment key={index}>
                            <div className="group w-84 h-42 bg-card border border-border rounded-2xl shadow-md p-6 relative">
                                <div className="w-full h-full flex flex-col justify-center items-center gap-4">
                                    <Skeleton className="h-16 w-16 rounded-full" />
                                    <Skeleton className="h-5 w-40" />
                                </div>
                            </div>
                        </Fragment>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default ProjectSkeleton


