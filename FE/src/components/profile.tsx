import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { changePasswordSchema } from "@/lib/schema";
import type { AuthUserType, ChangePasswordValuesType } from "@/lib/types";
import { useAuth } from "@/hooks/use-Auth";
import { baseAxios } from "@/lib/axios";
import { IconChevronDown, IconChevronUp, IconCrown, IconKey, IconLogout, IconMail, IconRefresh } from "@tabler/icons-react";
import { PlanDialog } from "./plan-dialog";


type ProfileProps = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

type UserIdentity = {
    provider: string;
    email: string | null;
};

export function Profile({ open, setOpen }: ProfileProps) {
    const { user, setUser } = useAuth();
    const [identities, setIdentities] = useState<UserIdentity[]>([]);
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isPlanOpen, setIsPlanOpen] = useState(false)
    const [lastFetch, setLastFetch] = useState(Date.now())

    const form = useForm<ChangePasswordValuesType>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
        mode: "onSubmit",
    });


    useEffect(() => {

        const fetchUserIdentities = async (user: AuthUserType) => {
            
            try {
                const res = await baseAxios.get(`/auth/identities`);
                if (res.status === 401) {
                    setUser(undefined);
                    throw new Error ("Authentication required. Please log in.")
                }
                if (res.data?.success && res.data?.identities) {
                    setIdentities(res.data.identities);
                } else {
                    setIdentities([{ provider: "Email", email: user.email }]);
                }
            } catch (err) {
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch linked identities. Defaulting to email."
                );
            }
        }
        if (open && user) {
            fetchUserIdentities(user);
        }
    }, [open, user]);

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    async function fetchStatus() {

        const promise = baseAxios.get("/auth/me")

        toast.promise(promise.then((res) => {
            if (res.status === 401) {
                setUser(undefined);
                throw new Error ("Authentication required. Please log in.")
            }
            if (res.status != 200 || !res.data?.success) {
                throw new Error()
            }
            if (new Date(res.data.user.primeExpiry && res.data.user.primeExpiry).getTime() > Date.now()) {
                console.log("updated user")
                setUser(res.data.user)
            }
            setLastFetch(Date.now())
            return
        }),
            {
                loading: "Checking membership status...",
                success: "Membership status fetched successfully!",
                error: (e) => e instanceof Error ? e.message : "Failed to fetch membership status. Please try again later.",
            }
        );
    }


    const onSubmitPasswordChange = async (values: ChangePasswordValuesType) => {
        try {
            setLoading(true);
            const res = await baseAxios.post("/auth/change-password", {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
                confirmPassword: values.confirmPassword
            });

            if (res.status === 401) {
                setUser(undefined);
                throw new Error ("Authentication required. Please log in.")
            }
            if (res.data?.success) {
                toast.success(res.data.message || "Password changed successfully.");
                form.reset();
                setIsPasswordOpen(false);
            } else {
                toast.error(res.data?.message || "Failed to change password.");
            }
        } catch (error) {
            if (error instanceof Error) {
                toast.error(error.message);
            } else {
                toast.error("An unexpected error occurred while changing password.");
            }
        } finally {
            setLoading(false);
        }
    };


    const handleLogout = async () => {
        try {
            await baseAxios.get("/auth/signout");
        } catch {
            // ignore — clear local state regardless
        }
        setUser(undefined);
        setOpen(false);
        window.location.replace("/");
    };

    if (!user) {
        return null;
    }

    const hasEmailProvider = identities.some((id) => id.provider === "Email");
    const isPrime = user.primeExpiry && new Date(user.primeExpiry).getTime() > Date.now();

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-full sm:max-w-[420px] max-h-[95vh] overflow-y-auto bg-[#0d0d0d] border border-white/[0.08] shadow-[0_25px_60px_rgba(0,0,0,0.6)] px-0 py-0">

                    {/* Profile card header */}
                    <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 border-b border-white/[0.06]">
                        <Avatar className="h-20 w-20 border-2 border-white/[0.12]">
                            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                            <AvatarFallback className="bg-gradient-to-br from-[#6366f1] to-[#a78bfa] text-white text-2xl font-semibold">
                                {getInitials(user.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-[#e4e4f0] flex items-center justify-center gap-2">
                                {user.name}
                                {isPrime && <IconCrown className="h-4 w-4 text-yellow-400" />}
                            </h3>
                            <p className="text-sm text-[#64648a] flex items-center justify-center gap-1.5 mt-1">
                                <IconMail className="h-3.5 w-3.5" />
                                {user.email || "No email"}
                            </p>
                            {isPrime && (
                                <div className="mt-3 flex flex-col items-center gap-1">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white">
                                        <IconCrown className="h-3.5 w-3.5" />
                                        Prime Member
                                    </span>
                                    {user.primeExpiry && (
                                        <span className="text-[11px] text-[#64648a]">
                                            Expires {new Date(user.primeExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    )}
                                </div>
                            )}
                            {!isPrime && (
                                <div className="mt-2 flex items-center justify-center gap-2">
                                    <span className="text-xs text-[#64648a] px-2 py-0.5 rounded border border-white/[0.08]">Free Plan</span>
                                    <button
                                        onClick={fetchStatus}
                                        className="flex items-center gap-1 text-[11px] text-[#64648a] hover:text-[#e4e4f0] transition-colors"
                                        title="Refresh membership status"
                                    >
                                        <IconRefresh className="h-3 w-3" />
                                        {`${Math.max(0, Math.floor((Date.now() - new Date(lastFetch).getTime()) / 60000))}m ago`}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-6 py-5 space-y-3">

                        {/* Upgrade button */}
                        {!isPrime && (
                            <Button
                                onClick={() => { setOpen(false); setIsPlanOpen(true); }}
                                disabled={loading}
                                className="w-full bg-[#6366f1] hover:bg-[#5558e8] text-white transition-colors"
                            >
                                <IconCrown className="h-4 w-4 mr-2" />
                                Upgrade to Prime
                            </Button>
                        )}

                        {/* Change password */}
                        {hasEmailProvider && (
                            <Collapsible open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                                <CollapsibleTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-between bg-white/[0.03] border-white/[0.08] text-[#c8c8d8] hover:bg-white/[0.06] hover:text-[#e4e4f0] text-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <IconKey className="h-4 w-4" />
                                            <span>Change Password</span>
                                        </div>
                                        {isPasswordOpen ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-3">
                                    <Form {...form}>
                                        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmitPasswordChange)}>
                                            <FormField
                                                control={form.control}
                                                name="currentPassword"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[#8a8390] text-sm">Current Password</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="••••••••" autoComplete="current-password"
                                                                className="bg-[#111118] border-white/[0.08] text-[#e4e4f0] placeholder:text-[#46424e] focus-visible:ring-[#6366f1]/30 focus-visible:border-[#6366f1]"
                                                                {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="newPassword"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[#8a8390] text-sm">New Password</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="••••••••" autoComplete="new-password"
                                                                className="bg-[#111118] border-white/[0.08] text-[#e4e4f0] placeholder:text-[#46424e] focus-visible:ring-[#6366f1]/30 focus-visible:border-[#6366f1]"
                                                                {...field} />
                                                        </FormControl>
                                                        <FormDescription className="text-[#64648a] text-xs">
                                                            Use at least 8 characters with numbers & symbols.
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="confirmPassword"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[#8a8390] text-sm">Confirm New Password</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="••••••••" autoComplete="new-password"
                                                                className="bg-[#111118] border-white/[0.08] text-[#e4e4f0] placeholder:text-[#46424e] focus-visible:ring-[#6366f1]/30 focus-visible:border-[#6366f1]"
                                                                {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button type="submit"
                                                className="w-full bg-[#6366f1] hover:bg-[#5558e8] text-white transition-colors"
                                                disabled={form.formState.isSubmitting || loading}
                                            >
                                                {form.formState.isSubmitting || loading ? "Updating..." : "Update Password"}
                                            </Button>
                                        </form>
                                    </Form>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        {/* Sign out */}
                        <Button
                            variant="outline"
                            onClick={handleLogout}
                            className="w-full border-red-500/25 text-[#f87171] hover:bg-red-500/[0.08] hover:border-red-500/50 hover:text-[#fca5a5] bg-transparent text-sm transition-colors"
                        >
                            <IconLogout className="h-4 w-4 mr-2" />
                            Sign out
                        </Button>
                    </div>

                </DialogContent>
            </Dialog>

            <PlanDialog open={isPlanOpen} setOpen={setIsPlanOpen} />
        </>
    );

}

