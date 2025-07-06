import { Skeleton } from "@/components/ui/skeleton"
import { ContentSkeleton } from './content-skeleton';

export function PageSkeleton() {
    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-64 border-1 rounded-xl py-2 m-2 flex flex-col">
                <div className="flex h-14 items-center p-4">
                    <Skeleton className="h-10 flex-1" />
                </div>
                <div className="space-y-2 p-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-center space-x-2 rounded-md p-2 hover:bg-accent">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-10 flex-1" />
                        </div>
                    ))}
                </div>
                <div className="mt-auto p-3 flex space-x-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[175px]" />
                        <Skeleton className="h-4 w-[150px]" />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 border-1 overflow-hidden rounded-xl m-2">
                {/* Header */}
                <div className="bg-background border-b-1 p-1 m-1">
                    <div className="flex h-14 items-center justify-between px-2">
                        <div className="flex items-center space-x-4">
                            <Skeleton className="h-10 w-10" />
                            <Skeleton className="h-10 w-60" />
                        </div>
                        <div className="flex items-center space-x-3">
                            <Skeleton className="h-10 w-10" />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1">
                    <div className="container mx-auto">
                        <ContentSkeleton />
                    </div>
                </div>
            </div>
        </div>
    )
}
