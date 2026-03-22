import { z } from "zod";
import { MerchantSchema } from "@/lib/contracts/merchant";
import {
	Currency,
	IntegerSchema,
	NonEmptyStringSchema,
	TimestampMsSchema,
	TimestampSecSchema,
} from "@/lib/shared/types";

const BasePaymentSchema = z.object({
	id: NonEmptyStringSchema,
	totalAmount: IntegerSchema,
	currency: z.enum(Currency),
});

const PaymentDetailSchema = z.discriminatedUnion("type", [
	BasePaymentSchema.extend({
		direction: z.literal("outgoing"),
		paymentSpecification: z.discriminatedUnion("type", [
			z.object({
				type: z.literal("lnInvoice"),
				lnInvoice: NonEmptyStringSchema,
				paymentHash: NonEmptyStringSchema,
				expirationIn: TimestampSecSchema,
			}),
		]),
	}),
	BasePaymentSchema.extend({
		direction: z.literal("incoming"),
		paymentSpecification: z.discriminatedUnion("type", [
			z.object({
				type: z.literal("lnurlWithdraw"),
				lnurl: NonEmptyStringSchema,
			}),
		]),
	}),
]);

const PaymentSchema = z.object({
	payment: PaymentDetailSchema,
	merchant: MerchantSchema.optional(),
});

export const NostrPayment = z.object({
	version: z.literal(1),
	generatedAt: TimestampMsSchema,
	payload: PaymentSchema,
});

export type NostrPayment = z.output<typeof NostrPayment>;
export type Payment = z.output<typeof PaymentSchema>;
