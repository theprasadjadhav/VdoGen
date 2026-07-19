import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";

import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/schema";
import type { LoginValuesType } from "@/lib/types";
import { baseAxios } from "@/lib/axios";
import { useAuth } from "@/hooks/use-Auth";
import { useNavigate } from "react-router";
import { useState } from "react";
import { Spinner } from "./ui/spinner";

type LoginFormProps = {
    onSwitchToSignup: () => void;
};

export function LoginForm({ onSwitchToSignup }: LoginFormProps) {

    const { setUser } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)

    const form = useForm<LoginValuesType>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
        mode: "onSubmit",
    });

    const onSubmit = async (values: LoginValuesType) => {
        try {
            setLoading(true)
            const res = await baseAxios.post(`/auth/signin`, { ...values })

            if (res.data?.success && res.data?.user) {
                setUser(res.data.user);
                toast.success(res.data.message || "Signed in successfully.");
                navigate("/chat");
            } else {
                toast.error(res.data?.message || "Failed to sign in. Please try again.");
            }

        } catch (error) {
            if (error instanceof Error) toast.error(error.message);
            else toast.error("An unexpected error occurred while signing in.");
        } finally {
            setLoading(false)
        }
    };

    return (
        <Form {...form}>
            <form
                className="space-y-3"
                onSubmit={e => { form.handleSubmit(onSubmit)(e); }}
            >
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[#e4e4f0] text-sm font-medium">Email</FormLabel>
                            <FormControl>
                                <Input
                                    type="email"
                                    placeholder="you@studio.com"
                                    autoComplete="email"
                                    className="bg-[#111118] border-white/10 text-[#e4e4f0] placeholder:text-[#3d3950] focus-visible:ring-1 focus-visible:ring-[#6366f1]/40 focus-visible:border-[#6366f1]/60"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage className="text-red-400" />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[#e4e4f0] text-sm font-medium">Password</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="bg-[#111118] border-white/10 text-[#e4e4f0] placeholder:text-[#3d3950] focus-visible:ring-1 focus-visible:ring-[#6366f1]/40 focus-visible:border-[#6366f1]/60"
                                    {...field}
                                />
                            </FormControl>
                            <FormDescription className="text-[#64648a] text-xs">
                                Use at least 8 characters with numbers & symbols.
                            </FormDescription>
                            <FormMessage className="text-red-400" />
                        </FormItem>
                    )}
                />

                <div className="flex items-center justify-between text-sm text-[#64648a]">
                    <span>Need an account?</span>
                    <button
                        type="button"
                        className="text-[#818cf8] hover:text-[#a78bfa] text-sm font-medium transition-colors cursor-pointer bg-transparent border-none p-0"
                        onClick={onSwitchToSignup}
                    >
                        Create one
                    </button>
                </div>

                <div className="flex justify-center gap-2 pt-1">
                    <button
                        onClick={() => window.history.back()}
                        type="button"
                        className="w-1/2 h-9 rounded-[10px] border border-white/10 text-[#64648a] text-sm font-medium bg-transparent hover:bg-white/[0.04] hover:text-[#e4e4f0] transition-all cursor-pointer"
                        disabled={form.formState.isSubmitting}
                    >
                        Back
                    </button>
                    <Button
                        type="submit"
                        className="w-1/2 bg-[#6366f1] text-white font-semibold hover:bg-[#5558e8] border-transparent rounded-[10px] transition-all hover:shadow-[0_6px_20px_rgba(99,102,241,0.35)]"
                        disabled={form.formState.isSubmitting}
                    >
                        {loading ? <Spinner /> : "Log in"}
                    </Button>
                </div>

                <p className="text-center text-xs text-[#46424e] pt-1">
                    By continuing you agree to our{' '}
                    <a href="/terms" className="text-[#818cf8] hover:underline">Terms</a>
                    {' '}and{' '}
                    <a href="/privacy" className="text-[#818cf8] hover:underline">Privacy Policy</a>.
                </p>
            </form>
        </Form>
    );
}
