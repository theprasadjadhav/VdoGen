import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { changePasswordSchema } from "@/lib/schema";
import type { AuthUserType, ChangePasswordValuesType } from "@/lib/types";
import { useAuth } from "@/hooks/use-Auth";
import { baseAxios } from "@/lib/axios";
import { IconChevronDown, IconChevronUp, IconCrown, IconKey, IconMail, IconRefresh, IconShield } from "@tabler/icons-react";
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


    if (!user) {
        return null;
    }

    const hasEmailProvider = identities.some((id) => id.provider === "Email");
    const isPrime = user.primeExpiry && new Date(user.primeExpiry).getTime() > Date.now();

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-full sm:max-w-lg md:max-w-xl lg:max-w-xl max-h-[95vh] overflow-y-auto border border-zinc-300 dark:border-slate-800 backdrop-blur bg-white/95 dark:bg-black/30 px-2 xs:px-4 sm:px-8 py-6 sm:py-8">
                    <DialogHeader>
                        <DialogTitle className="text-lg xs:text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-slate-50">
                            Profile Settings
                        </DialogTitle>
                        <DialogDescription className="text-xs xs:text-sm sm:text-base text-zinc-500 dark:text-slate-400">
                            Manage your account settings and preferences
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Profile Picture and Basic Info */}
                        <div className="flex flex-col items-center gap-4 pb-4">
                            <Avatar className="h-20 w-20 xs:h-24 xs:w-24 border-2 border-zinc-300 dark:border-slate-700">
                                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white text-xl xs:text-2xl font-semibold">
                                    {getInitials(user.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center space-y-1">
                                <h3 className="text-lg xs:text-xl font-semibold text-zinc-900 dark:text-slate-50 flex flex-wrap items-center justify-center gap-2">
                                    {user.name}
                                    {isPrime && (
                                        <IconCrown className="h-5 w-5 text-yellow-400" />
                                    )}
                                </h3>
                                <p className="text-xs xs:text-sm text-zinc-500 dark:text-slate-400 flex flex-wrap items-center justify-center gap-2">
                                    <IconMail className="h-4 w-4" />
                                    {user.email || "No email"}
                                </p>
                            </div>
                        </div>

                        <Separator className="bg-zinc-200 dark:bg-slate-800" />

                        {/* Prime Status */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center gap-2 ">
                                <div className="flex items-center gap-2">
                                    <IconShield className="h-5 w-5 text-zinc-500 dark:text-slate-400" />
                                    <span className="text-zinc-800 dark:text-slate-300 font-medium text-sm xs:text-base">Membership Status</span>
                                </div>
                                {isPrime ? (
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white border-0 shadow-lg shadow-purple-500/20 sm:px-3 py-1.5">
                                            <IconCrown className="h-4 w-4 mr-1.5" />
                                            <span className="font-semibold">Prime Member</span>
                                        </Badge>
                                        {user.primeExpiry && (
                                            <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-zinc-100 dark:bg-slate-900/90 border border-zinc-300 dark:border-slate-800/70 text-[9px] xs:text-[10px]">
                                                <span className="text-zinc-500 dark:text-slate-400">Exp:</span>
                                                <span className="ml-0.5 text-zinc-900 dark:text-slate-100 font-semibold">
                                                    {new Date(user.primeExpiry).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1">
                                        <Badge variant="outline" className="w-full border-zinc-400 dark:border-slate-700 text-zinc-500 dark:text-slate-400">
                                            Free Plan
                                        </Badge>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={fetchStatus}
                                            className="flex items-center rounded-md h-5"
                                        >
                                            <IconRefresh className="h-3! w-3!" />
                                            <span className="text-[8px] text-zinc-600 dark:text-slate-400">
                                                {`${Math.max(0, Math.floor((Date.now() - new Date(lastFetch).getTime()) / 60000))} min ago`}
                                            </span>
                                        </Button>


                                    </div>


                                )}
                            </div>
                            {!isPrime && (
                                <Button
                                    onClick={() => {
                                        setOpen(false)
                                        setIsPlanOpen(true)
                                    }}
                                    disabled={loading}
                                    className="w-full text-base xs:text-lg hover:bg-gradient-to-r hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 hover:text-white transition-colors"
                                >
                                    <IconCrown className="h-4 w-4 mr-2" />
                                    Upgrade to Prime
                                </Button>
                            )}

                        </div>

                        {/* change password */}
                        {hasEmailProvider && (
                            <>
                                <Separator className="bg-zinc-200 dark:bg-slate-800" />

                                <Collapsible open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                                    <CollapsibleTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-between border-zinc-300 dark:border-slate-800 bg-zinc-50 dark:bg-slate-900/50 hover:bg-zinc-100 dark:hover:bg-slate-800 text-sm xs:text-base"
                                        >
                                            <div className="flex items-center gap-2">
                                                <IconKey className="h-4 w-4" />
                                                <span>Change Password</span>
                                            </div>
                                            {isPasswordOpen ? (
                                                <IconChevronUp className="h-4 w-4" />
                                            ) : (
                                                <IconChevronDown className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-4">
                                        <Form {...form}>
                                            <form
                                                className="space-y-4"
                                                onSubmit={form.handleSubmit(onSubmitPasswordChange)}
                                            >
                                                <FormField
                                                    control={form.control}
                                                    name="currentPassword"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-zinc-700 dark:text-slate-300 text-sm xs:text-base">
                                                                Current Password
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="••••••••"
                                                                    autoComplete="current-password"
                                                                    className="bg-zinc-50 dark:bg-slate-900/50 border-zinc-300 dark:border-slate-800"
                                                                    {...field}
                                                                />
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
                                                            <FormLabel className="text-zinc-700 dark:text-slate-300 text-sm xs:text-base">
                                                                New Password
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="••••••••"
                                                                    autoComplete="new-password"
                                                                    className="bg-zinc-50 dark:bg-slate-900/50 border-zinc-300 dark:border-slate-800"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormDescription className="text-zinc-500 dark:text-slate-400 text-xs xs:text-sm">
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
                                                            <FormLabel className="text-zinc-700 dark:text-slate-300 text-sm xs:text-base">
                                                                Confirm New Password
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="••••••••"
                                                                    autoComplete="new-password"
                                                                    className="bg-zinc-50 dark:bg-slate-900/50 border-zinc-300 dark:border-slate-800"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <Button
                                                    type="submit"
                                                    className="w-full text-base xs:text-lg"
                                                    disabled={form.formState.isSubmitting || loading}
                                                >
                                                    {form.formState.isSubmitting || loading
                                                        ? "Updating..."
                                                        : "Update Password"}
                                                </Button>
                                            </form>
                                        </Form>
                                    </CollapsibleContent>
                                </Collapsible>
                            </>
                        )}

                    </div>
                </DialogContent>
            </Dialog>

            <PlanDialog open={isPlanOpen} setOpen={setIsPlanOpen} />
        </>
    );

}

