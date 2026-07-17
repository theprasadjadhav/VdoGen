import { AppSidebar } from "../../components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useHistory } from "@/hooks/use-history"
import { useActiveConversation } from "@/hooks/use-active-conversation"
import { useEffect, useRef, useState } from "react"
import { View, type ContentType } from "@/lib/types"
import { baseAxios } from "@/lib/axios"
import { ContentContainer } from "@/components/content-container"
import { PageSkeleton } from "@/components/skeleton/page-skeleton"
import { videoStatusEnum } from "@/lib/enums"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-Auth"


export default function Chat() {
    const { history, setHistory, historyLoading, historyError } = useHistory();
    const { activeConversation, setActiveConversation } = useActiveConversation();
    // const { content, setContent, contentError, contentLoading } = useContent()
    // const { user, setUser } = useAuth()

    const [content, setContent] = useState<ContentType[]>([]);
    const [contentError, setError] = useState<string | null>(null);
    const [contentLoading, setLoading] = useState(false);
    // const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const { user,setUser } = useAuth()


    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const previousActiveConversation = useRef<string | undefined>(undefined);
    const pageRef = useRef<number>(1);

    // useEffect(() => {
    //     setContent([]);
    //     setHasMore(true);
    //     setPage(1);
    //     setError(null);
    //     previousActiveConversation.current = activeConversation;
    // }, [activeConversation]);

    useEffect(() => {

        let isconversationChanged = false
        if(previousActiveConversation.current !== activeConversation){
            isconversationChanged = true;
            setContent([]);
            setHasMore(true);
            // setPage(1);
            pageRef.current = 1
            setError(null);
            previousActiveConversation.current = activeConversation;
        }

        let observer: IntersectionObserver | null = null;
        let cancelled = false;
        const fetchContent = async () => {
            console.log("[fetchContent] Called with page:", pageRef.current);
            try {
                setLoading(true);
                console.log("[fetchContent] Loading started");

                if (!user) {
                    console.error("[fetchContent] No authentication token available");
                    throw new Error("No authentication token available");
                }

                console.log(
                    `[fetchContent] Fetching: /content/conversation/${activeConversation}, page: ${pageRef.current}, limit: 10`
                );
                const response = await baseAxios.get(
                    `/content/conversation/${activeConversation}`,
                    {
                        params: {
                            page:pageRef.current,
                            limit: 10,
                        },
                    }
                );
                console.log("[fetchContent] Response status:", response.status);

                if (previousActiveConversation.current !== activeConversation || cancelled) {
                    console.warn(
                        "[fetchContent] Conversation changed or cancelled, aborting. previousActiveConversation:",
                        previousActiveConversation.current,
                        "activeConversation:", activeConversation,
                        "cancelled:", cancelled
                    );
                    return;
                }

                if (response.status === 401) {
                    setUser(undefined);
                    console.warn("[fetchContent] 401 Unauthorized. User unset.");
                    throw new Error("Authentication required. Please log in.");
                }

                if (response.status !== 200 || !response.data?.success) {
                    console.error(
                        "[fetchContent] Error: ",
                        response.data?.message ?? "Internal server error: Failed to fetch content"
                    );
                    throw new Error(
                        response.data?.message ?? "Internal server error: Failed to fetch content"
                    );
                }

                const contentData: ContentType[] = response.data.content ?? [];
                console.log("[fetchContent] Fetched contentData.length:", contentData.length, "hasMore:", response.data.hasMore);

                setContent((prev) => [...prev, ...contentData]);
                setHasMore(response.data.hasMore);
                // setPage((prev) => prev + 1);
                pageRef.current = pageRef.current + 1;
                setError(null);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Failed to fetch content";
                setError(errorMessage);
                console.error("[fetchContent] Caught error:", errorMessage);
            } finally {
                setLoading(false);
                console.log("[fetchContent] Loading finished");
            }
        };

        if (!activeConversation || activeConversation === "new") {
            setContent([]);
            setError(null);
            // setPage(1);
            pageRef.current = 1;
            setHasMore(true);
            return;
        }

        observer = new IntersectionObserver(
            (entries) => {
                if ((isconversationChanged) || (entries[0].isIntersecting && hasMore && !contentLoading)) {
                    fetchContent();
                    console.log("if")

                }else{
                    console.log("else")
                }
            },
            {
                rootMargin: "200px",
            }
        );

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => {
            observer?.disconnect();
            cancelled = true;
        };
    }, [activeConversation]);


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

            if (!user) {
                throw new Error('No authentication token available');
            }

            const response = await baseAxios.get(`/video/status?id=${newContent.id}`)

            if (response.status === 401) {
                setUser(undefined);
                throw new Error ("Authentication required. Please log in.")
            }

            if(response.status!=200 || !response.data?.success){
                throw new Error(response.data?.message ?? "Failed to fetch status")
            }

            const statusInfo = response.data

            if (content.length > 0) {
                const lastContent = content[content.length-1]
                if (statusInfo.id === lastContent.id && statusInfo.status != lastContent.status) {
                    lastContent.status = statusInfo.status
                    const updatedContent = [...content.slice(0, -1), lastContent]
                    setContent(updatedContent)
                }
            }

        } catch(e){
            toast.error(e instanceof Error ? e.message :  "An unexpected error occurred fetching video status");
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
                {history && <SiteHeader view={View.CHAT} header={history.find(h => h.id == activeConversation)?.firstPrompt} />}

                {
                    activeConversation && (
                        <ContentContainer
                            addNewContentToConversation={addNewContentToConversation}
                            content={content}
                            setContent={setContent}
                            contentError={contentError}
                            contentLoading={contentLoading}
                            contentContainerRef={sentinelRef}
                        />
                    )
                }
            </SidebarInset>
        </SidebarProvider>
    )
}