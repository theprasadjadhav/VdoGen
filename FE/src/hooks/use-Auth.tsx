import { baseAxios } from "@/lib/axios";
import type { AuthUserType } from "@/lib/types";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

 type AuthContextType = {
    user: AuthUserType | undefined;
    setUser: (user: AuthUserType | undefined) => void;
    loading: boolean;
    setLoading: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUserType | undefined>()
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        async function getUserData() {
            try {
                setLoading(true)
                const res = await baseAxios.get("/auth/me")
                if (res.status === 200 && res.data?.success) {
                    setUser(res.data.user)
                    setLoading(false)
                } else {
                    throw new Error("Authentication required. Please log in.")
                }
            } catch {
                setUser(undefined)
            }finally{
                setLoading(false)
            }
        }
        getUserData()
    }, [])

    return (
        <AuthContext.Provider value={{ user, setUser, loading, setLoading }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}