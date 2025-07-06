import type { ContentType } from "@/types";
import { VideoHolder } from "./video-holder";
import { useEffect, useRef, useState } from "react";
import { SearchArea } from "./search-area";
import { useActiveConversation } from "@/hooks/use-active-conversation";
import { ContentSkeleton } from "./content-skeleton";

type ChatContentType = { 
    addNewConversation: (newContent: ContentType) => void, 
    content: ContentType[], 
    contentLoading: boolean, 
    contentError: string | null 
}

export function ChatContent({ ...props }: ChatContentType) {
    const { addNewConversation, contentError, contentLoading, content } = props
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const { activeConversation } = useActiveConversation()
    const [searchAreaDisabled, setSearchAreaDisabled] = useState(false)

    useEffect(() => {
        
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }

        if (content && content.length > 0 && (content[content.length - 1].status == "processing" || content[content.length - 1].status == "initiated")) {
            setSearchAreaDisabled(true)
        } else {
            setSearchAreaDisabled(false)
        }
    }, [content]);

    if (contentLoading) {
        return <ContentSkeleton />;
    }

    if (contentError) {
        return <div className="flex items-center justify-center">Error: {contentError}</div>;
    }

    return <>
        <div className="flex flex-1 flex-col items-center p-2 h-[calc(100vh-4rem)]">
            {/* content container */}
            <div ref={chatContainerRef} className="w-full overflow-y-auto flex-1">
                {/* content */}
                <div className="max-w-[60%] mx-auto p-4">
                    <div className="flex flex-col gap-4 w-full max-w-full overflow-x-auto overflow-y-auto">
                        {activeConversation &&
                            content.map(c => (
                                <div key={c.id} className="flex flex-col gap-4">
                                    <pre className="w-3/4 ml-auto whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg">
                                        {c.prompt}
                                    </pre>

                                    {c.isError && (
                                        <pre  className="w-3/4 mr-auto whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg">
                                            {c.error}
                                        </pre>
                                    )}
                                    {c.status != 'complete' && (
                                        <pre className="w-3/4 mr-auto whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg">
                                            <span className="animate-pulse">{c.status}...</span>
                                        </pre>
                                    )}

                                    {c.status === 'complete' && (
                                        <VideoHolder id={c.id} />
                                    )}
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* search box */}
            <SearchArea
                key={`${activeConversation}-${content.length}`}
                className="flex flex-col items-center mt-auto w-full pt-2 sticky bottom-0 bg-background"
                addNewConversation={addNewConversation}
                disabled={searchAreaDisabled}
            />
        </div>
    </>
}