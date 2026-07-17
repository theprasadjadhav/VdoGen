import { baseAxios } from "@/lib/axios";
import { useEffect, useState } from "react"
import type { ContentType } from "@/lib/types";
import { useActiveConversation } from "./use-active-conversation";
import { useAuth } from "./use-Auth";


export const useContent = () => {
    const {activeConversation} = useActiveConversation();
    const [content, setContent] = useState<ContentType[]>([]);
    const [contentError, setError] = useState<string | null>(null);
    const [contentLoading, setLoading] = useState(false);
    const { user,setUser } = useAuth()


    useEffect(() => {
        const fetchContent = async () => {
            try {
                setLoading(true);
               
                if (!user) {
                    throw new Error('No authentication token available');
                }

                const response = await baseAxios.get(`/content/conversation/${activeConversation}`);
                if (response.status === 401) {
                    setUser(undefined);
                    throw new Error ("Authentication required. Please log in.")
                }
                if(response.status!=200 || !response.data?.success){
                    throw new Error(response.data?.message ?? "Internal server error: Failed to fetch content")
                }

                const contentData:ContentType[] = response.data.content
                
                setContent(contentData)
                setError(null)
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch content';
                setError(errorMessage)
                setContent([])
            } finally {
                setLoading(false)
            }
        };

        if(!activeConversation || activeConversation=="new"){
            setContent([])
            setError(null)

        }else{
            fetchContent()
        }
    }, [activeConversation])

    return { content, setContent, contentError, contentLoading };
}