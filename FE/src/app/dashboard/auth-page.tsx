import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { baseAxios } from "@/lib/axios";
import { useAuth } from "@/hooks/use-Auth";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { PageSkeleton } from "@/components/skeleton/page-skeleton";


type AuthMode = "login" | "signup";

type AuthProps = {
    mode?: AuthMode;
};

export default function Auth({ mode = "login" }: AuthProps) {

    const [activeMode, setActiveMode] = useState<AuthMode>(mode);
    const { setUser, loading, setLoading } = useAuth()
    const navigator = useNavigate()

    async function handleGoogleAuth(credentialResponse: CredentialResponse) {

        try {
            setLoading(true)
            const res = await baseAxios.post("/auth/google", {
                token: credentialResponse.credential
            })

            if (res.status === 200 && res.data?.success) {
                setUser(res.data.user)
                navigator("/chat")
            } else {
                throw Error("Failed to sign in with Google. Please try again.");
            }

        } catch (error) {
            if (error instanceof Error) {
                toast.error(error.message);
            } else {
                toast.error("An unexpected error occurred while signing in with Google.");
            }
        }finally{
            setLoading(false)
        }
    }

    if (loading) {
        <PageSkeleton/>
    }

    return (
        <div className="min-h-screen  text-slate-50  bg-gradient-to-br from-background to-muted/60">
            <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-16">
                <div className="flex-1">
                    <Card className="border-slate-800 dark:border-slate-600 shadow-lg shadow-slate-900/40 dark:bg-black/30 ">
                        <CardHeader className="space-y-4">
                            <div className="flex justify-center items-center gap-3">
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl text-center font-semibold">
                                        {activeMode === "login" ? "Welcome back" : "Create account"}
                                    </CardTitle>
                                    <CardDescription className="text-slate-400">
                                        {activeMode === "login"
                                            ? "Access your projects and keep shipping videos."
                                            : "Spin up an account to start collaborating faster."}
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={handleGoogleAuth}
                                    onError={() => {
                                        toast.error("Failed to sign in with Google. Please try again.")
                                    }}
                                    useOneTap
                                />
                            </div>
                            <div className="flex items-center mb-4 border-slate-800">
                                <hr className="flex-grow border-slate-800" />
                                <span className="mx-4 text-slate-400 dark:text-slate-300 text-sm">or</span>
                                <hr className="flex-grow border-slate-800" />
                            </div>
                            
                            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-1 shadow shadow-slate-900/40 transition-colors">
                                
                                <Button
                                    type="button"
                                    variant={activeMode === "login" ? "default" : "ghost"}
                                    className="flex-1"
                                    onClick={() => setActiveMode("login")}
                                >
                                    Login
                                </Button>
                                <Button
                                    type="button"
                                    variant={activeMode === "signup" ? "default" : "ghost"}
                                    className="flex-1"
                                    onClick={() => setActiveMode("signup")}
                                >
                                    Sign up
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {activeMode === "login" ? (
                                <LoginForm onSwitchToSignup={() => setActiveMode("signup")} />
                            ) : (
                                <SignupForm onSwitchToLogin={() => setActiveMode("login")} />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}