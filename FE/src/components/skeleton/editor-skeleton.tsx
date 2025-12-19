import { Skeleton } from "@/components/ui/skeleton"

export default function EditorSkeleton() {
    return (
        <div className="flex flex-1 h-full w-full py-2 bg-gradient-to-br from-background to-muted/60">
            {/* main editor */}
            <div className='flex flex-col justify-center p-8 w-full'>
                {/* back, save, download */}
                <div className='flex justify-between items-center'>
                    {/* back button */}
                    <div className="flex items-center gap-2">
                        <Skeleton className='h-9 w-40' />
                    </div>

                    {/* save & download */}
                    <div className='flex gap-2 items-center'>
                        <Skeleton className='h-9 w-10 rounded-md' />
                        <Skeleton className='h-9 w-24 rounded-md' />
                    </div>
                </div>

                {/* video player, controls */}
                <div className='flex flex-col gap-3 justify-center items-center h-[75%] mt-6'>
                    {/* video area */}
                    <div className="w-3/5">
                        <div className="relative w-full">
                            <Skeleton className="w-full aspect-video rounded-md" />
                        </div>
                    </div>

                    {/* transport controls */}
                    <div className='flex gap-2'>
                        <Skeleton className='h-9 w-9 rounded-md' />
                        <Skeleton className='h-9 w-9 rounded-md' />
                    </div>
                </div>

                {/* timeline */}
                <div className='mt-6 '>
                    <div className="flex justify-between mb-3"> 
                    <div className="flex">
                        <Skeleton className='h-7 w-7 mr-3' />
                        <Skeleton className='h-7 w-7' />
                    </div>
                    <div className='flex items-center justify-between mb-2'>

                        <div className='flex items-center gap-2'>
                            <Skeleton className='h-7 w-7' />
                            <Skeleton className='h-7 w-20' />
                        </div>
                    </div>
                    </div>

                    <div className='w-full border border-border rounded-md p-3 bg-card'>
                        {/* timeline header */}

                        {/* tracks */}
                        <div className='space-y-3'>

                            <div className='h-16 rounded-md border border-border p-2 flex items-center gap-2 overflow-hidden'>
                                <div className='flex-1 flex items-center gap-2'>
                                    <Skeleton className='h-6 flex-1 rounded-md' />
                                    <Skeleton className='h-6 w-94 rounded-md' />
                                    <Skeleton className='h-6 w-86 rounded-md' />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* right sidebar */}
            <div className='hidden xl:block w-[128px] border-l border-border p-3 bg-background'>
                <div className='space-y-4'>
                    <div>
                        <Skeleton className='h-12 w-full mb-3' />
                        <Skeleton className='h-12 w-full' />
                    </div>

                </div>
            </div>
        </div>
    )
}




