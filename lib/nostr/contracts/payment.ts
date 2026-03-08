import { z } from "zod";
import { MerchantSchema } from "@/lib/nostr/contracts/merchant";
import {
	Currency,
	IntegerSchema,
	NonEmptyStringSchema,
	TimestampMsSchema,
	TimestampSecSchema,
	Timezone,
} from "@/lib/shared/types";

const BasePaymentSchema = z.object({
	id: NonEmptyStringSchema,
	totalAmount: IntegerSchema,
	currency: z.enum(Currency),
});

const PaymentSchema = z.discriminatedUnion("type", [
	BasePaymentSchema.extend({
		direction: z.literal("incoming"),
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
		direction: z.literal("outgoing"),
		paymentSpecification: z.discriminatedUnion("type", [
			z.object({
				type: z.literal("lnurlWithdraw"),
				lnurl: NonEmptyStringSchema,
			}),
		]),
	}),
]);

export const NostrPayment = z.object({
	version: z.literal(1),
	generatedAt: TimestampMsSchema,
	timezone: z.enum(Timezone),
	payment: PaymentSchema,
	merchant: MerchantSchema.optional(),
});

export type NostrPayment = z.output<typeof NostrPayment>;
