import { baseAxios } from "@/lib/axios"
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/clerk-react";
import type { HistoryType } from "@/types";

export const useHistory = () => {
    const [history, setHistory] = useState<HistoryType[]>([])
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [historyLoading, setLoading] = useState(true);

    const { getToken } = useAuth()

    useEffect(() => {

        async function getHistory() {
            try {
                setLoading(true)
                const token = await getToken()

                if(!token){
                    throw new Error("No authentication token available")
                }

                const res = await baseAxios.get("/history", {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if(res.status!=200){
                    throw new Error("Internal server error: Failed to fetch content")
                }

                const history: HistoryType[] = res.data
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