import type { ContentType } from "@/types";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { FormSchema, SearchArea } from "./search-area";
import { useActiveConversation } from "@/hooks/use-active-conversation";
import { ContentSkeleton } from "./skeleton/content-skeleton";
import { videoStatusEnum } from "@/lib/enums";
import ErrorAlert from "./error-alert";
import WelcomeMessage from "./welcome-message";
import Content from "./content";
import { toast } from "sonner";
import { baseAxios } from "@/lib/axios";
import { useAuth } from "@clerk/clerk-react";
import type z from "zod";


type ChatContentType = {
    addNewContentToConversation: (newContent: ContentType) => void,
    content: ContentType[],
    setContent: Dispatch<SetStateAction<ContentType[]>>,
    contentError: string | null,
    contentLoading: boolean,
}

export function ContentContainer({ ...props }: ChatContentType) {
    const { addNewContentToConversation, content, setContent, contentError, contentLoading } = props

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const { activeConversation } = useActiveConversation()
    const [searchAreaDisabled, setSearchAreaDisabled] = useState(false)
    const { getToken } = useAuth()

    const handleVideoAdded = (contentId: string, projectIds: string[]) => {
        setContent((content) => {
            const newContent = content.map(item =>
                item.id === contentId ? { ...item, editorProject: projectIds.map(id => ({ id })) } : item
            );
            return newContent
        })
    }

    async function generateVideo(data: z.infer<typeof FormSchema>) {
        try {
            const token = await getToken();
            if (!token) {
                throw new Error('No authentication token available, Please Login');
            }

            const genResponse = await baseAxios.post("/video/gen",
                {
                    prompt: data.prompt,
                    specs: data.specs,
                    conversationId: activeConversation
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (genResponse.data.id) {
                const newContent: ContentType = genResponse.data;
                addNewContentToConversation(newContent);
            } else if (!genResponse.data.success) {
                toast.warning(genResponse.data.message)
            } else {
                new Error('Failed to generate content');
            }
        } catch (err) {
            let errorMessage = 'Failed to process request';

            if (err instanceof Error) {
                if (err.message.includes('ECONNREFUSED') || err.message.includes('Redis')) {
                    errorMessage = 'Server is temporarily unavailable. Please try again in a few moments.';
                } else if (err.message.includes('No authentication token')) {
                    errorMessage = 'Please login to continue.';
                } else {
                    errorMessage = err.message;
                }
            }
            toast.error(errorMessage)
        }
    }

    useEffect(() => {

        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }

        if (content?.at(-1)?.status === videoStatusEnum.PROCESSING || content?.at(-1)?.status === videoStatusEnum.INITIATED) {
            setSearchAreaDisabled(true)
        } else {
            setSearchAreaDisabled(false)
        }
    }, [content]);


    if (contentError) {
        return <ErrorAlert message="Oops! We couldn't load your content. Please try again in a moment." />
    }

    return <>
        <div className="flex flex-1 flex-col items-center p-2 h-[calc(100vh-4rem)]">

            <div ref={chatContainerRef} className="w-full overflow-y-auto flex-1">

                {
                    contentLoading ? <ContentSkeleton />
                        :
                        <div className="max-w-[90%] md:max-w-[60%] h-full mx-auto p-4">
                            {
                                content.length > 0 && activeConversation
                                    ? <Content content={content} handleVideoAdded={handleVideoAdded} />
                                    : <WelcomeMessage />
                            }
                        </div>
                }
            </div>

            {/* search box */}
            <SearchArea
                className="flex flex-col items-center mt-auto w-full pt-2 sticky bottom-0 bg-background"
                onSubmit={generateVideo}
                disabled={searchAreaDisabled}
            />
        </div >
    </>
}


