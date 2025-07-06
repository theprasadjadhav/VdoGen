import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useHistory } from "@/hooks/use-history"
import { useActiveConversation } from "@/hooks/use-active-conversation"
import { useEffect } from "react"
import { useContent } from "@/hooks/use-content"
import type { ContentType } from "@/types"
import { useAuth } from "@clerk/clerk-react"
import { baseAxios } from "@/lib/axios"
import { ChatContent } from "@/components/chat-content"
import { PageSkeleton } from "@/components/page-skeleton"


export default function Page() {
    const { activeConversation, setActiveConversation } = useActiveConversation()
    const { history, setHistory, historyLoading, historyError, setError } = useHistory();
    const { content, setContent, contentError, contentLoading } = useContent();
    const { getToken } = useAuth()

    useEffect(() => {
        if (!activeConversation && history && history.length > 0) {
            setActiveConversation(history[0].id);
        }
    }, [history]);

    useEffect(() => {
        if (content && content.length > 0) {
            const lastContent = content[content.length - 1];
            
            if (lastContent.status === "processing" || lastContent.status === "initiated") {
                const pollInterval = setInterval(() => {
                    poolStatus(lastContent);
                }, 5000);

                return () => {
                    clearInterval(pollInterval);
                };
            }
        }
    }, [content]);

    async function poolStatus(newContent: ContentType) {
        try {
            const token = await getToken();

            if (!token) {
                throw new Error('No authentication token available');
            }

            const response = await baseAxios.get(`/status?id=${newContent.id}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.status == 200) {
                const statusInfo = response.data

                if (content.length > 0) {
                    const lastContent = content[content.length - 1]

                    if (statusInfo.id === lastContent.id && statusInfo.status != lastContent.status) {
                        lastContent.status = statusInfo.status
                        const updatedContent = [...content.slice(0, -1), lastContent]
                        setContent(updatedContent)
                    }
                }
            } else {
                throw new Error(response.data.message)
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "failed to fetch status")
        }
    }

    function addNewConversation(newContent: ContentType) {
        if (activeConversation=="new") {
            setHistory(preHistory => {
                const newHistory = [{ id: newContent.conversationId, firstPrompt: newContent.prompt }, ...preHistory]
                return newHistory
            })
            setActiveConversation(newContent.conversationId)
        } else if(activeConversation == newContent.conversationId){
            setContent(prevContent => {
                const newContentArray = [...prevContent, newContent];
                return newContentArray;
            });
        }        
    }

    if (historyLoading) {
        return <PageSkeleton/>;
    }

    if (historyError) {
        return <div className="flex items-center justify-center" >Error: {historyError}</div>;
    }

    return (
        <SidebarProvider>
            <AppSidebar variant="inset" history={history} />
            <SidebarInset>
                {/* header */}
                {history && <SiteHeader  history={history} />}

                {activeConversation && <ChatContent content={content} addNewConversation={addNewConversation} contentLoading={contentLoading} contentError={contentError}/>}
            </SidebarInset>
        </SidebarProvider>
    )
}