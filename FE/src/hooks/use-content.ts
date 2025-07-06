import { baseAxios } from "@/lib/axios";
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react"
import type { ContentType } from "@/types";
import { useActiveConversation } from "./use-active-conversation";


export const useContent = () => {
    const {activeConversation} = useActiveConversation();
    const [content, setContent] = useState<ContentType[]>([]);
    const [contentError, setError] = useState<string | null>(null);
    const [contentLoading, setLoading] = useState(false);
    const { getToken } = useAuth();

    useEffect(() => {
        const fetchContent = async () => {
            try {
                setLoading(true);
                const token = await getToken();
                
                if (!token) {
                    throw new Error('No authentication token available');
                }

                const response = await baseAxios.get(`/content/${activeConversation}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const contentData:ContentType[] = response.data
                
                setContent(contentData);
                setError(null);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch content';
                setError(errorMessage);
                setContent([]);
            } finally {
                setLoading(false);
            }
        };

        if(!activeConversation || activeConversation=="new"){
            setLoading(true)
            setContent([]);
            setLoading(false);
            setError(null);
        }else{
            fetchContent();
        }
    }, [activeConversation]);

    return { content, setContent, contentError, contentLoading };
}