import { Skeleton } from "@/components/ui/skeleton"

export function ContentSkeleton() {
    return (
        <div className="flex flex-1 flex-col items-center p-2 h-[calc(100vh-4rem)]">
            <div className="w-full  flex-1">
                <div className="max-w-[60%] mx-auto p-4">
                    <div className="flex flex-col gap-4 w-full max-w-full">
                        {/* User message skeleton */}
                        <div className="flex flex-col gap-4">
                            <Skeleton className="h-[60px] w-3/4 ml-auto rounded-lg" />
                            <Skeleton className="h-[400px]  rounded-lg" />
                        </div>
                        
                        {/* Another message pair */}
                        <div className="flex flex-col gap-4">
                            <Skeleton className="h-[60px] w-3/4 ml-auto rounded-lg" />
                            <Skeleton className="h-[400px]  rounded-lg" />

                        </div>

                        
                    </div>
                </div>
            </div>
        </div>
    )
}
