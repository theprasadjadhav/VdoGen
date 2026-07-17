import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useAuth } from "@/hooks/use-Auth";
import { baseAxios } from "@/lib/axios";
import { IconCrown, IconCheck } from "@tabler/icons-react";
import { PaymentStatusDialog } from "./payment-status-dialog";
import axios from "axios";


type PlanDialogProps = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

type PlanDuration = "ONEMONTH" | "THREEMONTH" | "ONEYEAR";

const currencyBasePriceMap: Record<string, { basePrice: number; sign: string }> = {
    INR: { basePrice: 999, sign: "₹" },
    USD: { basePrice: 9.99, sign: "$" },
};


function getPlanDetails(currency: string): Record<string, { name: string; price: number; discount: number; originalPrice: number; monthlyPrice: number }> {
    const basePrice = currencyBasePriceMap[currency]?.basePrice ?? 999;
    return {
        ONEMONTH: {
            name: "1 Month",
            price: basePrice,
            discount: 0,
            originalPrice: basePrice,
            monthlyPrice: basePrice,
        },
        THREEMONTH: {
            name: "3 Months",
            price: parseFloat((basePrice * 3 * (1 - 0.2)).toFixed(2)),
            discount: 0.2,
            originalPrice: parseFloat((basePrice * 3).toFixed(2)),
            monthlyPrice: parseFloat(((basePrice * 3 * (1 - 0.2)) / 3).toFixed(2)),
        },
        ONEYEAR: {
            name: "12 Months",
            price: parseFloat((basePrice * 12 * (1 - 0.35)).toFixed(2)),
            discount: 0.35,
            originalPrice: parseFloat((basePrice * 12).toFixed(2)),
            monthlyPrice: parseFloat(((basePrice * 12 * (1 - 0.35)) / 12).toFixed(2)),
        },
    };
}

const PRIME_PLAN_FEATURES = [
    "Unlimited video generations",
    "High-quality video output",
    "Advanced editing tools",
    "HD video export",
];

export function PlanDialog({ open, setOpen }: PlanDialogProps) {
    const { user, setUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState<PlanDuration>("ONEYEAR");
    const [isStatusOpen, setIsStatusOpen] = useState(false)
    const [status, setStatus] = useState<string | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [statusLoading, setStatusLoading] = useState(false)
    const [currency, setCurrency] = useState<string>("INR");

    useEffect(() => {
        const fetchCurrency = async () => {
            try {
                const res = await axios.get("https://ipapi.co/json/");
                const data = res.data;
                if (data.currency && (data.currency === "INR" || data.currency === "USD")) {
                    setCurrency(data.currency);
                } else {
                    setCurrency("USD");
                }
            } catch {
                setCurrency("USD");
            }
        };
        fetchCurrency();
    }, []);

    async function fetchStatus(payment_id: string) {
        setIsStatusOpen(true)
        setStatusError(null);
        setStatusLoading(true);
        setStatus(null);

        if (!payment_id) {
            setStatusError("Payment not found. Please try again later.");
            setStatusLoading(false);
            return;
        }

        try {
            const res = await baseAxios.post(`/payment/status?payment_id=${payment_id}`);

            if (res.status === 401) {
                setUser(undefined);
                throw new Error ("Authentication required. Please log in.")
            }
            if (res.status !== 200 || !res.data?.success) {
                setStatusError("Failed to fetch payment status, Please tey again later.");
                setStatusLoading(false);
                return;
            }
            setStatus(res.data.paymentStatus);
            setUser(res.data.user);
        } catch (err) {
            setStatusError(err instanceof Error ? err.message : "Failed to fetch payment status, Please tey again later..");
        } finally {
            setStatusLoading(false);
            setTimeout(() => setIsStatusOpen(false), 3000)
        }
    }

    const handlePay = async (selectedPlan: PlanDuration, currency:string) => {
        try {
            setLoading(true);
            const res = await baseAxios.post("/payment/pay", { plan: selectedPlan, currency });
            
            if (res.status === 401) {
                setUser(undefined);
                throw new Error ("Authentication required. Please log in.")
            }

            if (res.status != 200 || !res.data?.success) {
                throw new Error(res.data?.message ?? "There was an error processing your payment.");
            }

            const data = res.data;

            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: data.amount,
                currency: data.currency,
                order_id: data.orderId,

                name: "VdoGen",
                description: "Prime Plan",

                handler: function (data: { razorpay_payment_id: string }) {
                    fetchStatus(data.razorpay_payment_id)
                },

                prefill: {
                    name: user?.name,
                    email: user?.email,
                },

                theme: {
                    color: "#3399cc",
                },
            };

            setOpen(false)
            // @ts-expect-error may throw error
            const razorpay = new window.Razorpay(options);
            razorpay.open();
        } catch (error) {
            const message = error instanceof Error ? error.message : "There was an error processing your payment.";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return null;
    }

    const isPrime = user.primeExpiry && new Date(user.primeExpiry).getTime() > Date.now();
    const planDetails = getPlanDetails(currency)

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="!max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-slate-800 bg-white/95 dark:bg-black/70 backdrop-blur">
                    <DialogHeader className="text-center pb-2">
                        <DialogTitle className="text-lg xs:text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-slate-50">
                            Upgrade to Prime
                        </DialogTitle>
                        <DialogDescription className="text-xs xs:text-sm sm:text-base text-zinc-600 dark:text-slate-400">
                            Unlock unlimited video generation and premium features
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                        {/* Prime Plan */}
                        <div className="max-w-2xl mx-auto w-full  rounded-xl bg-gradient-to-br from-zinc-100 via-zinc-50 to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950/80 shadow-lg px-3 xs:px-6 py-4 xs:py-6 flex flex-col items-center sm:flex-row gap-5 xs:gap-7 md:gap-12 sm:items-start border border-zinc-200 dark:border-slate-800">
                            <div className="flex-1 flex flex-col min-w-[160px] xs:min-w-[230px]">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400/15 dark:bg-yellow-500/15">
                                        <IconCrown className="h-4 w-4 xs:h-5 xs:w-5 text-yellow-600 dark:text-yellow-400" />
                                    </span>
                                    <span className="text-lg xs:text-2xl font-bold text-zinc-900 dark:text-slate-50 tracking-tight">
                                        Prime Plan
                                    </span>
                                </div>
                                <div className="text-zinc-700 dark:text-slate-400 text-sm xs:text-base font-medium mb-3">
                                    Everything you need for <span className="text-emerald-600 dark:text-emerald-400">unlimited creativity</span>
                                </div>
                                <div className="mt-auto">
                                    <span className="text-3xl xs:text-4xl md:text-5xl font-bold text-zinc-900 dark:text-slate-50 leading-none drop-shadow">
                                        {currencyBasePriceMap[currency].sign}{planDetails[selectedDuration].monthlyPrice.toFixed(2)}
                                    </span>
                                    <span className="text-xs xs:text-sm text-zinc-600 dark:text-slate-400 mb-[2px]">/month</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-[160px] xs:min-w-[230px] gap-3">
                                <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 mb-2">
                                    {PRIME_PLAN_FEATURES.map((feature, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 p-2 rounded-md bg-zinc-100 dark:bg-slate-800/50 border border-zinc-200 dark:border-slate-700/60 shadow-sm"
                                        >
                                            <IconCheck className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                            <span className="text-xs sm:text-sm text-zinc-800 dark:text-slate-200">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>

                        {/* Upgrade Options */}
                        {!isPrime && (
                            <>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                        {Object.entries(planDetails).map(([planKey, plan]) => {
                                        
                                            const isSelected = selectedDuration === planKey;

                                            return (
                                                <Card
                                                    key={planKey}
                                                    className={`cursor-pointer transition-colors ${isSelected
                                                        ? "border border-purple-400 bg-zinc-100 dark:bg-slate-900/60"
                                                        : "border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900/40 hover:border-zinc-300 dark:hover:border-slate-600"
                                                        }`}
                                                    onClick={() => setSelectedDuration(planKey as PlanDuration)}
                                                >
                                                    <CardHeader className="pb-2">
                                                        <div className="flex flex-col justify-center sm:flex-row sm:items-center gap-2 sm:justify-between">
                                                            <div className="flex flex-col gap-1">
                                                                <CardTitle className={`text-[11px] xs:text-sm font-semibold ${isSelected
                                                                    ? "text-purple-700 dark:text-purple-300"
                                                                    : "text-zinc-900 dark:text-slate-50"
                                                                    }`}>
                                                                    {plan.name}
                                                                </CardTitle>
                                                                <CardDescription className="text-[8px] sm:text-xs text-zinc-500 dark:text-slate-400">
                                                                    {planKey === "ONEMONTH"
                                                                        ? "Billed monthly"
                                                                        : `Billed every ${plan.name}`}
                                                                </CardDescription>
                                                            </div>
                                                            {plan.discount > 0 && (
                                                                <Badge className=" bg-emerald-400/20 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 dark:border-emerald-600/30 text-[10px] xs:text-xs">
                                                                    Save {plan.discount*100}%
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="mt-auto">
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                                <span className={`text-base text-[14px] xs:text-xl font-semibold ${isSelected
                                                                    ? "text-purple-700 dark:text-purple-300"
                                                                    : "text-zinc-900 dark:text-slate-50"
                                                                    }`}>
                                                                    {currencyBasePriceMap[currency].sign}{plan.price.toFixed(2)}
                                                                </span>
                                                                {plan.discount > 0 && (
                                                                    <span className="text-[8px] xs:text-xs text-zinc-400 dark:text-slate-500 line-through">
                                                                        ${plan.originalPrice.toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {planKey != "ONEMONTH" && (
                                                                <div className="text-[10px] xs:text-xs text-zinc-500 dark:text-slate-400">
                                                                    {currencyBasePriceMap[currency].sign}{plan.monthlyPrice.toFixed(2)}/month
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        onClick={() => handlePay(selectedDuration,currency)}
                                        disabled={loading}
                                        className="w-full text-sm xs:text-base hover:bg-gradient-to-r hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 hover:text-white transition-colors"
                                    >
                                        {loading ? (
                                            <span className="flex items-center gap-2">
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span className="text-xs xs:text-sm">Processing...</span>
                                            </span>
                                        ) : (
                                            <>
                                                <IconCrown className="h-4 w-4 mr-2" />
                                                <span className="text-xs xs:text-sm">Upgrade to Prime</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <PaymentStatusDialog
                open={isStatusOpen}
                setOpen={setIsStatusOpen}
                loading={statusLoading}
                status={status ?? undefined}
                errorMsg={statusError ?? undefined}
            />
        </>
    );
}