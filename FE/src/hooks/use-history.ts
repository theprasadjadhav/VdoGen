import { baseAxios } from "@/lib/axios"
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/clerk-react";
import type { HistoryType } from "@/types";

export const useHistory = () => {
    const [history, setHistory] = useState<HistoryType[]>([])
    const [historyError, setError] = useState<string | null>(null);
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
                const history: HistoryType[] = res.data
                setHistory(history)
                setError(null)
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch content';
                setError(errorMessage);
                setHistory([]);
            }finally{
                setLoading(false)
            }
        }

        getHistory()

    }, [])

    return {history, setHistory, historyLoading,setLoading, historyError,setError}
}