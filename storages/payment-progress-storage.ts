import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import {
	Currency,
	type InferEnumType,
	NonEmptyStringSchema,
	Uuid7Schema,
} from "@/lib/types";
import { PaymentMerchantSchema } from "@/storages/payment-storage";

export const BillPaymentOption = {
	BtcLn: "btcLn",
	BankTransferCZ: "bankTransferCZ",
} as const;
export type BillPaymentOption = InferEnumType<typeof BillPaymentOption>;

export const PaymentInitSchema = z.object({
	paymentId: Uuid7Schema,
	items: z
		.object({
			id: z.string(),
			price: z.number(),
			quantity: z.number(),
		})
		.array(),
	tip: z.number(),
	currency: z.enum(Currency),
	paymentOption: z.object({
		type: z.enum(BillPaymentOption),
	}),
	merchant: PaymentMerchantSchema.optional(),
});

const BasePaymentReadySchema = z.object({
	paymentId: Uuid7Schema,
	bill: z.object({
		items: z
			.object({
				id: z.string(),
				price: z.number(),
				quantity: z.number(),
				label: z.string(),
			})
			.array(),
		tip: z.number().optional(),
		currency: z.enum(Currency),
	}),
	// When a customer wants to pay in different currency
	amountExpectedToPay: z
		.object({
			value: z.number(),
			rate: z.number(),
			currency: z.enum(Currency),
		})
		.optional(),
});

export const PaymentReadySchema = z.discriminatedUnion("type", [
	BasePaymentReadySchema.extend({
		type: z.literal("btcLn"),
		lnInvoice: z.string(),
	}),
	BasePaymentReadySchema.extend({
		type: z.literal("bankTransferCZ"),
		qrCode: z.string(),
	}),
]);

const BasePaymentFinishedSchema = z.object({
	paymentId: Uuid7Schema.optional(), // When missing, then it's not stored to the payment history
});

export const PaymentFinishedSchema = z.discriminatedUnion("type", [
	BasePaymentFinishedSchema.extend({
		type: z.literal("success"),
	}),
	BasePaymentFinishedSchema.extend({
		type: z.literal("failure"),
		reason: NonEmptyStringSchema,
		refund: z
			.discriminatedUnion("type", [
				z.object({
					type: z.literal("btcLn"),
					lnInvoice: z.string(),
				}),
			])
			.optional(),
	}),
]);

export type PaymentInit = z.output<typeof PaymentInitSchema>;
export type PaymentReady = z.output<typeof PaymentReadySchema>;
export type PaymentFinished = z.output<typeof PaymentFinishedSchema>;

export const paymentInitStorage = createNostrStorage({
	namespace: "finito_payment_init",
	schema: PaymentInitSchema,
	useEncryption: true,
});

export const paymentReadyStorage = createNostrStorage({
	namespace: "finito_payment_ready",
	schema: PaymentReadySchema,
	useEncryption: true,
});

export const paymentFinishedStorage = createNostrStorage({
	namespace: "finito_payment_finished",
	schema: PaymentFinishedSchema,
	useEncryption: true,
});
