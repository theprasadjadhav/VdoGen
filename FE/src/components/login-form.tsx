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
            const res = await baseAxios.post(`/auth/signin`, {
                ...values
            })

            if (res.data?.success && res.data?.user) {
                setUser(res.data.user);
                toast.success(res.data.message || "Signed in successfully.");
                navigate("/chat");
            } else {
                toast.error(res.data?.message || "Failed to sign in. Please try again.");
            }

        } catch (error) {
            if (error instanceof Error) {
                toast.error(error.message);
            } else {
                toast.error("An unexpected error occurred while signing in.");
            }
        } finally {
            setLoading(false)
        }
    };

    return (
        <Form {...form}>
            <form
                className="space-y-3"
                onSubmit={e => {
                    form.handleSubmit(onSubmit)(e);
                }}
            >
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input
                                    type="email"
                                    placeholder="you@studio.com"
                                    autoComplete="email"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    {...field}
                                />
                            </FormControl>
                            <FormDescription className="text-slate-400">
                                Use at least 8 characters with numbers & symbols.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Need an account?</span>
                    <Button
                        type="button"
                        variant="link"
                        className="p-0 text-emerald-300 hover:text-emerald-200"
                        onClick={onSwitchToSignup}
                    >
                        Create one
                    </Button>
                </div>
                <div className="flex justify-center gap-2">
                    <Button
                        onClick={() => window.history.back()}
                        type="button"
                        className="w-1/2"
                        variant="outline"
                        disabled={form.formState.isSubmitting}
                    >
                        Back
                    </Button>
                    <Button
                        type="submit"
                        className="w-1/2"
                        disabled={form.formState.isSubmitting}
                    >
                        {loading ?
                            <Spinner />
                            : "Login"}
                    </Button>
                </div>
                <p className="text-center text-xs text-slate-500">
                    By continuing you agree to our Terms and Privacy Policy.
                </p>
            </form>
        </Form>
    );
}