import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import {
	FiatCurrency,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	PercentSchema,
	Timezone,
} from "@/lib/types";
import { InvoicePaymentMethod } from "@/storages/invoice-storage";
import { PaymentMethod } from "@/storages/payment-storage";

export const BillingSettingsSchema = z.object({
	taxRates: z
		.object({
			name: NonEmptyStringSchema.optional(),
			rate: PercentSchema,
		})
		.array(),
	defaultInvoiceDueDateDays: NonNegativeIntegerSchema,
	defaultCurrency: z.enum(FiatCurrency),
	defaultTimezone: z.enum(Timezone),
	defaultPayment: z.union([
		z.object({
			method: z.null(),
			bankAccountKey: NonEmptyStringSchema.nullable(),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.BankTransfer),
			bankAccountKey: NonEmptyStringSchema,
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.Cash),
			bankAccountKey: NonEmptyStringSchema.nullable(),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.PaymentCard),
			bankAccountKey: NonEmptyStringSchema,
		}),
	]),
	defaultPaymentMethod: z.enum(PaymentMethod).default(PaymentMethod.Cash),
	defaultBankTransferCzKey: NonEmptyStringSchema.optional(),
	defaultLnZapKey: NonEmptyStringSchema.optional(),
	defaultLnSparkKey: NonEmptyStringSchema.optional(),
	invoiceEmailSettings: z
		.object({
			subject: NonEmptyStringSchema,
			body: NonEmptyStringSchema,
		})
		.optional(),
});

export type BillingSettings = z.output<typeof BillingSettingsSchema>;

export const billingSettingsStorage = createNostrStorage({
	namespace: "finito_billing_settings",
	schema: BillingSettingsSchema,
	useEncryption: true,
});
