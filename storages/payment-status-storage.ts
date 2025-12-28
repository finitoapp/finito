import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { type InferEnumType, Uuid7Schema } from "@/lib/types";

export const PaymentStatus = {
	Unpaid: "unpaid",
	Paid: "paid",
} as const;
export type PaymentStatus = InferEnumType<typeof PaymentStatus>;

const BasePaymentStatusSchema = z.object({
	paymentId: Uuid7Schema,
});

export const PaymentStatusSchema = z.discriminatedUnion("status", [
	BasePaymentStatusSchema.extend({
		status: z.literal(PaymentStatus.Unpaid),
	}),
	BasePaymentStatusSchema.extend({
		status: z.literal(PaymentStatus.Paid),
		prove: z.discriminatedUnion("type", [
			z.object({
				type: z.literal("bankTransferCZ"),
			}),
			z.object({
				type: z.literal("lnZap"),
			}),
			z.object({
				type: z.literal("cash"),
			}),
		]),
	}),
]);

export const paymentStatusStorage = createNostrStorage({
	namespace: "finito_payment_status",
	schema: PaymentStatusSchema,
	useEncryption: true,
});
