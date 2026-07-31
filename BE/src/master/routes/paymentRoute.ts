import { Router } from "express";
import { sendError } from "../functions";
import { authMiddleware } from "../middlewares";
import express from "express";
import {  prismaClient, razorpay, redis } from "../../util/config";
import type { PaymentStatus } from "../../../generated/prisma";
import { logger } from "../../util/config";
import crypto from "crypto";
import { paymentLimiter } from "../rateLimiters";

const paymentRoute = Router()

const currencyBasePriceMap: Record<string, { basePrice: number; sign: string; smallestUnitMultiplier: number }> = {
    INR: { basePrice: 999, sign: "₹", smallestUnitMultiplier: 100 },    
    USD: { basePrice: 9.99, sign: "$", smallestUnitMultiplier: 100 }    
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

paymentRoute.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];

        const body = req.body.toString();

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
            .update(body)
            .digest('hex');

        if (expectedSignature != signature) {
            logger.error({
                msg: "Razorpay webhook signature mismatch",
                expectedSignature: expectedSignature,
                receivedSignature: signature,
                body: body
            });
            res.status(200).json({ received: true });
            return
        }

        const session = JSON.parse(body);

        if (!session?.payload?.payment?.entity) {
            logger.error({
                msg: "Missing payment details in webhook payload",
                payload: session?.payload,
            });
            res.status(400).json({ error: "Missing payment details in webhook payload" });
            return;
        }

        const paymentDetails = session.payload.payment.entity;

        let status: PaymentStatus
        let paidAt: Date | undefined
        switch (session.event) {
            case "payment.captured": {
                status = "SUCCESS";
                paidAt = new Date();
                break;
            }
            case "payment.failed": {
                status = "FAILED";
                break;
            }
            default:
                logger.error({
                    msg: `Unhandled event type`,
                    eventName: session.event
                });
                res.status(200).json({ received: true });
                return
        }

        const key = `rzp:${session.event}:${paymentDetails.id}`;

        const isNewWebhook = await redis.set(key, "1", "EX", 60 * 60 * 24, "NX");

        if (!isNewWebhook) {
            logger.info({
                msg: "Razorpay webhook already processed for this payment",
                key,
                event: session.event,
                paymentId: paymentDetails.id
            });
            res.status(200).json({ received: true });
            return
        }

        const payment = await prismaClient.payment.upsert({
            where: { razorpayPaymentId: paymentDetails.id },
            update: {
                status: status,
                paidAt: paidAt,
            },
            create: {
                razorpayOrderId: paymentDetails.order_id,
                razorpayPaymentId: paymentDetails.id,
                plan: paymentDetails.notes?.plan,
                amount: paymentDetails.amount,
                currency: paymentDetails.currency,
                customerEmail: paymentDetails.email,
                status: status,
                paidAt: paidAt,
                paymentMethod: paymentDetails.method,
                userId: paymentDetails.notes?.userId
            },
            include: {
                user: true
            }
        });

    
        logger.info({
            msg: "Payment record upserted",
            paymentStatus: payment.status,
            paymentId: payment.id,
            userId: payment.userId
        });

        if (payment.status === "SUCCESS") {
            const user = payment.user;
            let expiry;
          
            const now = user.primeExpiry && user.primeExpiry > new Date() ? user.primeExpiry : new Date();
            const monthsToAdd = payment.plan === "THREEMONTH" ? 3 : payment.plan === "ONEYEAR" ? 12 : 1;
            expiry = new Date(now);
            expiry.setMonth(expiry.getMonth() + monthsToAdd);

            await prismaClient.user.update({
                where: {
                    id: payment.userId
                },
                data: {
                    primeExpiry: expiry
                }
            });

            logger.info({
                msg: "User prime status/expiry updated",
                userId: payment.userId,
                newPrimeExpiry: expiry
            });
        }

        res.status(200).json({ received: true });
    } catch (err) {
        logger.error({
            msg: "Error processing razorpay webhook",
            error: err
        });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

paymentRoute.use(express.json())

paymentRoute.use(authMiddleware)

paymentRoute.post("/status", paymentLimiter , async (req, res) => {

    const { payment_id } = req.query

    if (!payment_id || typeof payment_id !== 'string') {
        logger.info({
            msg: "Status endpoint called with missing or invalid payment_id",
            payment_id
        });
        return sendError(res, 400, "payment_Id is required");
    }

    try {
        const payment = await prismaClient.payment.findUnique({
            where: {
                razorpayPaymentId: payment_id
            },
            include: {
                user: {
                    omit: {
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        });

        if (!payment) {
            logger.info({
                msg: "Payment not found for payment_id",
                payment_id
            });
            return sendError(res, 404, "Payment not found");
        }

        logger.info({
            msg: "Payment status found, setting cookie and returning",
            payment_id,
            paymentStatus: payment.status,
            plan: payment.plan,
            paidAt: payment.paidAt
        });


        res.status(200).json({
            success: true,
            message: "Payment status fetched successfully",
            paymentStatus: payment.status,
            plan: payment.plan,
            paidAt: payment.paidAt,
            user: {
                ...payment.user
            }
        });

    } catch (err) {
        logger.error({
            msg: "Failed to fetch payment status",
            payment_id,
            error: err instanceof Error ? err.message : err
        });
        return sendError(res, 500, "Failed to fetch payment status");
    }
})

paymentRoute.post('/pay', paymentLimiter, async (req, res) => {

    const user = req.user!
    const selectedPlan = req.body.plan;
    const currency = req.body.currency;

    if (!selectedPlan || !currency) {
        return sendError(res, 400, "Plan and currency are required");
    }

    const planDetails = getPlanDetails(currency)
    const plan = planDetails[selectedPlan];

    if (!plan || !currencyBasePriceMap[currency]) {
        logger.error({
            msg: "Plan not found in planDetails",
            plan: selectedPlan,
            currency: currency,
            userId: user.id
        });
        return sendError(res, 400, "Invalid currency/plan selected");
    }

    logger.info({
        msg: "Initiating razorpay order",
        userId: user.id,
        selectedPlan,
        currency,
        amount: plan.price
    });

    try {
        const order = await razorpay.orders.create({
            amount: plan.price * currencyBasePriceMap[currency].smallestUnitMultiplier,
            currency: currency,
            receipt: "receipt_" + Date.now(),
            notes: {
                userId: user.id,
                plan: selectedPlan
            }
        });

        res.status(200).json({
            success: true,
            message: "order created successfully",
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (err) {
        logger.error({
            msg: "Failed to create Razorpay order",
            userId: user.id,
            plan: selectedPlan,
            currency: currency,
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined
        });
        return sendError(res, 500, err instanceof Error ? err.message : "Failed to create Razorpay order");
   
    }

});

export default paymentRoute;