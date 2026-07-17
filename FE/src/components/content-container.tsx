import type { ContentType } from "@/lib/types";
import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { SearchArea } from "./search-area";
import { useActiveConversation } from "@/hooks/use-active-conversation";
import { ContentSkeleton } from "./skeleton/content-skeleton";
import { videoStatusEnum } from "@/lib/enums";
import ErrorAlert from "./error-alert";
import WelcomeMessage from "./welcome-message";
import Content from "./content";
import { toast } from "sonner";
import { baseAxios } from "@/lib/axios";
import type z from "zod";
import { VideoGenFormSchema as FormSchema } from '../lib/schema';
import { useAuth } from "@/hooks/use-Auth";
import { PlanDialog } from "./plan-dialog";


type ChatContentType = {
    addNewContentToConversation: (newContent: ContentType) => void,
    content: ContentType[],
    setContent: Dispatch<SetStateAction<ContentType[]>>,
    contentError: string | null,
    contentLoading: boolean,
    contentContainerRef: RefObject<HTMLDivElement | null>
}

export function ContentContainer({ ...props }: ChatContentType) {
    const { addNewContentToConversation, content, setContent, contentError, contentLoading, contentContainerRef } = props

    const [isPlanOpen, setIsPlanOpen] = useState(false)
    // const chatContainerRef = useRef<HTMLDivElement>(null);
    const { activeConversation } = useActiveConversation()
    const [searchAreaDisabled, setSearchAreaDisabled] = useState(false)
    const { user, setUser } = useAuth()

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
            if (!user) {
                throw new Error('No authentication token available');
            }

            if (user.useCount >= 3) {
                if (!user.primeExpiry) {
                    setIsPlanOpen(true)
                    toast.error("You have reached the limit for free users. Please upgrade to Prime to generate more videos.");
                    return
                } else if (user.primeExpiry && (new Date(user.primeExpiry).getTime() < Date.now())) {
                    setIsPlanOpen(true)
                    toast.error("Your Prime plan has expired. Please renew to continue generating videos.");
                    return
                }
            }

            const genResponse = await baseAxios.post("/video/create",
                {
                    prompt: data.prompt,
                    specs: data.specs,
                    conversationId: activeConversation
                }
            );

            if (genResponse.status === 401) {
                setUser(undefined);
                throw new Error ("Authentication required. Please log in.")
            }
            if (genResponse.status != 200 || !genResponse.data?.success) {
                throw new Error(genResponse.data?.message ?? 'Failed to generate video');
            }

            const newContent: ContentType = genResponse.data?.video;
            addNewContentToConversation(newContent);
            if (JSON.stringify(user) !== JSON.stringify(genResponse.data.user)) {
                setUser(genResponse.data.user)
            }

        } catch (err) {
            let errorMessage = 'Failed to process request';

            if (err instanceof Error) {
                if (err.message.includes('ECONNREFUSED') || err.message.includes('Redis')) {
                    errorMessage = 'Server is temporarily unavailable. Please try again in a few moments.';
                } else {
                    errorMessage = err.message;
                }
            }
            toast.error(errorMessage)
        }
    }

    useEffect(() => {

        // if (chatContainerRef.current) {
        //     chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        // }

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

            <div ref={contentContainerRef} className="w-full overflow-y-auto flex-1">

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

            {/* plan dialog */}
            <PlanDialog open={isPlanOpen} setOpen={() => setIsPlanOpen(false)} />
        </div >
    </>
}


