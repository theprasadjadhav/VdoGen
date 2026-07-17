import { baseAxios } from "@/lib/axios"
import { useEffect, useState } from "react"
import type { HistoryType } from "@/lib/types";
import { useAuth } from "./use-Auth";

export const useHistory = () => {
    const [history, setHistory] = useState<HistoryType[]>([])
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [historyLoading, setLoading] = useState(true);

    const { user,setUser } = useAuth()


    useEffect(() => {

        async function getHistory() {
            try {
                setLoading(true)
               
                if (!user) {
                    throw new Error('No authentication token available');
                }

                const res = await baseAxios.get("/content/history")

                if (res.status === 401) {
                    setUser(undefined);
                    throw new Error ("Authentication required. Please log in.")
                }
                if(res.status!=200 || !res.data?.success){
                    throw new Error(res.data?.message ?? "Internal server error: Failed to fetch content")
                }

                const history: HistoryType[] = res.data.history
                setHistory(history)
                setHistoryError(null)
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch History';
                setHistoryError(errorMessage);
                setHistory([]);
            }finally{
                setLoading(false)
            }
        }

        getHistory()

    }, [])

    return {history, setHistory, historyLoading,setLoading, historyError,setHistoryError}
}