

import { type Dispatch, type SetStateAction } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { IconCheck, IconX, } from "@tabler/icons-react";




const statusLabels: Record<string, { label: string, icon: React.ReactNode, color: string }> = {
    SUCCESS: {
        label: "Payment Successful!",
        icon: <IconCheck className="h-8 w-8 text-green-500" />,
        color: "text-emerald-500"
    },
    FAILED: {
        label: "Payment Failed",
        icon: <IconX className="h-8 w-8 text-rose-500" />,
        color: "text-rose-500"
    },
    ERROR: {
        label: "Something went wrong",
        icon: <IconX className="h-8 w-8 text-yellow-500" />,
        color: "text-yellow-500"
    }
};

type PaymentStatusDialogProps = {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    loading: boolean;
    status?: string;
    errorMsg?: string;
};

export function PaymentStatusDialog({ open, setOpen, loading, status, errorMsg }: PaymentStatusDialogProps) {

    return (
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
            <DialogContent className="max-w-md w-xs sm:w-md shadow-sm shadow-slate-200/30 dark:shadow-slate-950/60  border border-zinc-300 dark:border-slate-800 backdrop-blur bg-white/95 dark:bg-black/30">
                <DialogHeader className="space-y-2">
                    <div className="flex justify-center items-center gap-3">
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl text-center font-semibold text-zinc-900 dark:text-slate-50">
                                Payment Status
                            </DialogTitle>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center py-8 gap-4 min-h-[200px]">
                    {loading ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-8 w-8 border-4 border-zinc-300 dark:border-slate-800 border-t-zinc-400 dark:border-t-slate-400 rounded-full animate-spin" />
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-zinc-600 dark:text-slate-300 font-medium">
                                    Fetching payment status...
                                </span>
                                <span className="text-zinc-500 dark:text-slate-400 text-sm">
                                    Please wait
                                </span>
                            </div>
                        </div>
                    ) : status === "ERROR" ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 rounded-full border border-zinc-300 dark:border-slate-800 bg-zinc-100/70 dark:bg-slate-900/60">
                                {statusLabels[status]?.icon}
                            </div>
                            <div className="flex flex-col items-center gap-2 text-center max-w-xs">
                                <span className="text-rose-500 font-semibold text-lg">{statusLabels[status]?.label}</span>
                                <span className="text-zinc-500 dark:text-slate-400 text-sm">
                                    {errorMsg}
                                </span>
                            </div>
                        </div>
                    ) : status ? (
                        <div className="flex flex-col items-center gap-5">
                            <div className="p-5 rounded-full border border-zinc-300 dark:border-slate-800 bg-zinc-100/70 dark:bg-slate-900/60">
                                {statusLabels[status]?.icon}
                            </div>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <span
                                    className={`font-semibold text-xl ${statusLabels[status]?.color}`}
                                >
                                    {statusLabels[status]?.label}
                                </span>
                                {status === "SUCCESS" && (
                                    <span className="text-zinc-600 dark:text-slate-400 text-sm">
                                        Your payment has been processed successfully
                                    </span>
                                )}
                                {status === "FAILED" && (
                                    <span className="text-zinc-600 dark:text-slate-400 text-sm">
                                        Please try again or contact support
                                    </span>
                                )}
                            </div>
                        </div>
                    ) :
                    <div className="flex flex-col items-center gap-4">
                            <div className="p-4 rounded-full border border-zinc-300 dark:border-slate-800 bg-zinc-100/70 dark:bg-slate-900/60">
                            {statusLabels["Error"]?.icon}
                            </div>
                            <div className="flex flex-col items-center gap-2 text-center max-w-xs">
                                <span className="text-rose-500 font-semibold text-lg"> {statusLabels["Error"]?.label}</span>
                                <span className="text-zinc-500 dark:text-slate-400 text-sm">
                                    An unexpected error occurred. Please try again later.
                                </span>
                            </div>
                        </div>
                    }
                </div>

            </DialogContent>
        </Dialog>
    );
}
