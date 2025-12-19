import { videoStatusEnum } from "@/lib/enums";
import { Alert, AlertTitle } from "./ui/alert";
import { IconAlertCircle, IconDownload } from "@tabler/icons-react";
import type { ContentType } from "@/types";
import { VideoHolder } from "./video-holder";
import { Button } from "./ui/button";
import { AddVideoToProjectDialog } from "./add-video-to-project-dialog";
import { toast } from "sonner";
import { useAuth } from "@clerk/clerk-react";
import { baseAxios } from "@/lib/axios";

type ContentComponentType = {
    content: ContentType[],
    handleVideoAdded: (contentId: string, projectIds: string[]) => void
}

export default function Content({ content, handleVideoAdded }: ContentComponentType) {

    const { getToken } = useAuth()

    async function downloadVideo(id: string) {

        try {

            const token = await getToken()

            if (!token) {
                throw new Error("User not authenticated")
            }
            const response = baseAxios.get(`/video/download?videoId=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                responseType: "blob",
            });


            toast.promise(response.then((res) => {
                if (!res || res.status !== 200) {
                    throw new Error(res.data.message);
                }

                const contentType = res.headers?.["content-type"] || "video/mp4";
                const blob = new Blob([res.data], { type: contentType });
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = "video.mp4";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);
                return
            }),
                {
                    loading: "Downloading video...",
                    success: () => "video downloaded successfully",
                    error: "Oops! Something went wrong. Please try again."
                }
            )

        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Download failed.");
        }
    }


    return (
        <div className="flex flex-col gap-4 w-full max-w-full overflow-x-auto overflow-y-auto">
            {
                content.map(c => (
                    <div key={c.id} className="flex flex-col gap-4">
                        <pre className="w-3/4 ml-auto whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg">
                            {c.prompt}
                        </pre>

                        {c.isError && (
                            <pre className="w-3/4 mr-auto whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg">
                                {c.error}
                            </pre>
                        )}
                        {c.status != videoStatusEnum.COMPLETE && (
                            <pre className=" mr-auto whitespace-pre-wrap break-words ">

                                {(c.status === videoStatusEnum.PROCESSING || c.status === videoStatusEnum.INITIATED) ?
                                    <span className="animate-pulse text-muted-foreground">{c.status}...</span>
                                    :
                                    <Alert variant="destructive">
                                        <IconAlertCircle />
                                        <AlertTitle>{c.status ? c.status : "Something went wrong"}  </AlertTitle>
                                    </Alert>
                                }
                            </pre>
                        )}

                        {c.status === videoStatusEnum.COMPLETE && (
                            <div>
                                <VideoHolder id={c.id} />
                                <div className="flex justify-start items-center pt-1">
                                    <Button
                                        size={"sm"}
                                        variant={"ghost"}
                                        onClick={() => downloadVideo(c.id)}
                                        title="Download video"
                                    >
                                        <IconDownload color="grey" />

                                    </Button>
                                    
                                    <AddVideoToProjectDialog
                                        contentItem={c}
                                        onVideoAdded={handleVideoAdded}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))
            }
        </div>
    )
}

