import { z } from "zod";
import { PaymentMerchantSchema } from "@/lib/evolu/model/payment";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	Currency,
	type InferEnumType,
	IntegerSchema,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
} from "@/lib/shared/types";

export const BillPaymentOption = {
	BtcLn: "btcLn",
	BankTransferCZ: "bankTransferCZ",
} as const;
export type BillPaymentOption = InferEnumType<typeof BillPaymentOption>;

export const PaymentInitSchema = z.object({
	paymentId: TableIdSchema,
	items: z
		.object({
			// The POS must verify that the item ID exists on the current bill.
			id: TableIdSchema,
			// The POS must verify that the item price is still the same.
			price: IntegerSchema,
			// The POS must verify that the requested quantity can be paid.
			// The quantity must not exceed what is available on the bill and must not use finer units than allowed.
			quantity: z.number(),
			// The POS should ignore label changes.
			// The label is primarily used for display in payment details.
			// The label is used by the POS to generate better user messages (e.g., "Beer is no longer on the bill").
			label: z.string(),
		})
		.array(),
	// The POS must verify that the tip amount is allowed.
	tip: NonNegativeIntegerSchema,
	// The POS must verify that the currency is supported.
	currency: z.enum(Currency),
	// The POS must verify that the payment option is supported.
	paymentOption: z.object({
		type: z.enum(BillPaymentOption),
	}),
	// The POS should ignore merchant changes.
	// The merchant structure is primarily used for display in payment details.
	merchant: PaymentMerchantSchema.optional(),
});

const BasePaymentReadySchema = z.object({
	paymentId: TableIdSchema,
	bill: z.object({
		items: z
			.object({
				id: TableIdSchema,
				price: IntegerSchema,
				quantity: z.number(),
				label: z.string(),
			})
			.array(),
		tip: IntegerSchema.optional(),
		currency: z.enum(Currency),
	}),
	// Used when a customer wants to pay in a different currency.
	amountExpectedToPay: z
		.object({
			value: IntegerSchema,
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
	paymentId: z.string().optional(), // If missing, it is not stored in the payment history.
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
