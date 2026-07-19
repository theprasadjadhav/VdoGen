import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
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
    const [selectedDuration, setSelectedDuration] = useState<PlanDuration>("THREEMONTH");
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
                <DialogContent className="!max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto bg-[#0d0d0d] border border-white/[0.08] shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
                    <DialogHeader className="text-center pb-4">
                        <DialogTitle className="text-xl sm:text-2xl font-semibold text-[#e4e4f0]">
                            Upgrade to Prime
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[#64648a]">
                            Unlock unlimited video generation and premium features
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        {/* Plan cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                            {Object.entries(planDetails).map(([planKey, plan]) => {
                                const isSelected = selectedDuration === planKey;
                                const isPopular = planKey === "THREEMONTH";

                                return (
                                    <div
                                        key={planKey}
                                        onClick={() => !isPrime && setSelectedDuration(planKey as PlanDuration)}
                                        className={`relative rounded-xl border p-6 transition-all flex flex-col ${
                                            isPrime ? "cursor-default" : "cursor-pointer"
                                        } ${
                                            isSelected && !isPrime
                                                ? "border-[#6366f1] shadow-[0_0_0_1px_rgba(99,102,241,0.12),0_8px_32px_rgba(99,102,241,0.08)] bg-[#111111]"
                                                : "border-white/[0.08] bg-[#111111] hover:border-white/[0.15]"
                                        }`}
                                    >
                                        {/* Most Popular badge */}
                                        {isPopular && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-[#6366f1] to-[#a78bfa] text-white whitespace-nowrap">
                                                Most Popular
                                            </div>
                                        )}

                                        {/* Plan name row with save badge */}
                                        <div className="flex items-center justify-between mb-3">
                                            <p className={`text-xs font-semibold uppercase tracking-widest ${isSelected && !isPrime ? "text-[#a78bfa]" : "text-[#64648a]"}`}>
                                                {plan.name}
                                            </p>
                                            {plan.discount > 0 && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">
                                                    Save {plan.discount * 100}%
                                                </span>
                                            )}
                                        </div>

                                        {/* Price */}
                                        <div className="flex items-baseline gap-0.5 mb-1">
                                            <span className="text-base text-[#e4e4f0]">{currencyBasePriceMap[currency].sign}</span>
                                            <span className="text-4xl font-bold text-[#e4e4f0] leading-none tracking-tight">{plan.monthlyPrice.toFixed(2)}</span>
                                            <span className="text-sm text-[#64648a] ml-1">/mo</span>
                                        </div>

                                        {/* Billing sub */}
                                        <p className="text-xs text-[#64648a] mb-5 min-h-[1.25rem]">
                                            {planKey === "ONEMONTH"
                                                ? "Billed monthly"
                                                : `${currencyBasePriceMap[currency].sign}${plan.price.toFixed(2)} billed every ${plan.name}`
                                            }
                                        </p>

                                        {/* Divider */}
                                        <div className="h-px bg-white/[0.06] mb-4" />

                                        {/* Features */}
                                        <ul className="space-y-2.5 flex-1">
                                            {[
                                                ...PRIME_PLAN_FEATURES,
                                                ...(plan.discount > 0 ? [`${plan.discount * 100}% off vs monthly`] : []),
                                            ].map((feature, i) => (
                                                <li key={i} className="flex items-center gap-2 text-xs text-[#c8c8d8]">
                                                    <IconCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>

                        {/* CTA */}
                        {!isPrime ? (
                            <Button
                                onClick={() => handlePay(selectedDuration, currency)}
                                disabled={loading}
                                className="w-full bg-[#6366f1] hover:bg-[#5558e8] text-white text-sm transition-colors"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </span>
                                ) : (
                                    <>
                                        <IconCrown className="h-4 w-4 mr-2" />
                                        Upgrade to Prime
                                        <span className="ml-2 opacity-60">·</span>
                                        <span className="ml-2 font-normal">{planDetails[selectedDuration].name}</span>
                                        <span className="ml-1 opacity-60 font-normal">({currencyBasePriceMap[currency].sign}{planDetails[selectedDuration].price.toFixed(2)})</span>
                                    </>
                                )}
                            </Button>
                        ) : (
                            <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5">
                                <IconCrown className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                                <p className="text-sm text-[#e4e4f0]">
                                    You're on Prime — active until{" "}
                                    <span className="text-yellow-400 font-medium">
                                        {new Date(user.primeExpiry!).toLocaleDateString()}
                                    </span>
                                </p>
                            </div>
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