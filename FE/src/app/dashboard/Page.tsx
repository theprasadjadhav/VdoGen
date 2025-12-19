import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useHistory } from "@/hooks/use-history"
import { useActiveConversation } from "@/hooks/use-active-conversation"
import { useEffect } from "react"
import type { ContentType } from "@/types"
import { useAuth } from "@clerk/clerk-react"
import { baseAxios } from "@/lib/axios"
import { ContentContainer } from "@/components/content-container"
import { PageSkeleton } from "@/components/skeleton/page-skeleton"
import { videoStatusEnum } from "@/lib/enums"
import { useContent } from "@/hooks/use-content"
import { toast } from "sonner"


export default function Page() {
    const { history, setHistory, historyLoading, historyError } = useHistory();
    const { activeConversation, setActiveConversation } = useActiveConversation();
    const { content, setContent, contentError, contentLoading } = useContent()
    const { getToken } = useAuth();

    useEffect(() => {
        setActiveConversation("new")
    }, [])


    useEffect(() => {

        let pollInterval: ReturnType<typeof setInterval> | undefined;

        if (content && content.length > 0) {
            const lastContent = content[content.length - 1];

            if (lastContent.status === videoStatusEnum.PROCESSING || lastContent.status === videoStatusEnum.INITIATED) {
                pollInterval = setInterval(() => {
                    poolStatus(lastContent);
                }, 5000);
            }
        }

        return () => {
            if (pollInterval)
                clearInterval(pollInterval);
        };
    }, [content])

    async function poolStatus(newContent: ContentType) {
        try {
            const token = await getToken();

            if (!token) {
                throw new Error('No authentication token available');
            }

            const response = await baseAxios.get(`/video/status?id=${newContent.id}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })


            const statusInfo = response.data

            if (content.length > 0) {
                const lastContent = content[content.length-1]

                if (statusInfo.id === lastContent.id && statusInfo.status != lastContent.status) {
                    lastContent.status = statusInfo.status
                    const updatedContent = [...content.slice(0, -1), lastContent]
                    setContent(updatedContent)
                }
            }

        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to fetch status"
            toast.error(message)
        }
    }

    function addNewContentToConversation(newContent: ContentType) {
        if (activeConversation == "new") {
            setHistory(preHistory => {
                const newHistory = [{ id: newContent.conversationId, firstPrompt: newContent.prompt }, ...preHistory]
                return newHistory
            })
            setActiveConversation(newContent.conversationId)
        } else if (activeConversation == newContent.conversationId) {
            setContent(prevContent => {
                const newContentArray = [...prevContent, newContent];
                return newContentArray;
            })
        }
    }

    if (historyLoading) {
        return <PageSkeleton />
    }

    return (
        <SidebarProvider>
            <AppSidebar variant="inset" history={history} setHistory={setHistory} historyError={historyError} />
            <SidebarInset>
                {/* header */}
                {history && <SiteHeader history={history} />}

                {
                    activeConversation && (
                        <ContentContainer
                            addNewContentToConversation={addNewContentToConversation}
                            content={content}
                            setContent={setContent}
                            contentError={contentError}
                            contentLoading={contentLoading}
                        />
                    )
                }
            </SidebarInset>
        </SidebarProvider>
    )
}