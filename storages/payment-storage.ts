import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import {
	Currency,
	HttpsUrlSchema,
	IbanSchema,
	type InferEnumType,
	NonEmptyStringSchema,
	PhoneSchema,
	Uuid7Schema,
} from "@/lib/types";

export const PaymentMethod = {
	BankTransferCZ: "bankTransferCZ",
	Cash: "cash",
	LnZap: "lnZap",
	LnSpark: "lnSpark",
} as const;
export type PaymentMethod = InferEnumType<typeof PaymentMethod>;

const BillItemSchema = z.object({
	id: z.string(),
	price: z.number(),
	quantity: z.number(),
	label: z.string(),
	optionality: z
		.object({
			checked: z.number(),
		})
		.optional(), // false when missing
});

export const BillSchema = z.object({
	currency: z.enum(Currency),
	allowTip: z.boolean().optional(),
	items: BillItemSchema.array(),
});

export type BillItem = z.output<typeof BillItemSchema>;
export type Bill = z.output<typeof BillSchema>;

export const AddressSchema = z.object({
	street: NonEmptyStringSchema,
	descriptiveNumber: NonEmptyStringSchema,
	city: NonEmptyStringSchema,
	postalCode: NonEmptyStringSchema,
});

export const PaymentMerchantSchema = z.object({
	name: NonEmptyStringSchema,
	businessAddress: AddressSchema.optional(),
	// officeAddress: AddressSchema.optional(),
	phone: PhoneSchema.optional(),
});

export type PaymentMerchant = z.output<typeof PaymentMerchantSchema>;

export const PaymentSchema = z.object({
	id: Uuid7Schema,
	bill: BillSchema,
	merchant: PaymentMerchantSchema.optional(),
	// In the future, it is expected that more variants will be introduced
	onSuccessfulPayment: z
		.object({
			_tag: z.literal("httpRedirect"),
			redirectUrl: HttpsUrlSchema,
		})
		.optional(),
	paymentOptions: z
		.discriminatedUnion("type", [
			z.object({
				type: z.literal("lnZap"),
				lnInvoice: z.string(),
				walletPubkey: z.string(),
				amount: z.number(),
				expirationIn: z.number(),
			}),
			z.object({
				type: z.literal("lnSpark"),
				accountId: z.string(),
				lnInvoice: z.string(),
				sparkInvoiceId: z.string(),
				amount: z.number(),
				expirationIn: z.number(),
			}),
			z.object({
				type: z.literal("bankTransferCZ"),
				iban: IbanSchema,
				variableSymbol: z.string(),
			}),
			z.object({
				type: z.literal("cash"),
			}),
		])
		.array()
		.optional()
		.default([]),
	privateKey: z.string(),
	webPaymentEventId: z.string(),
});

export type Payment = z.output<typeof PaymentSchema>;

export const paymentStorage = createNostrStorage({
	namespace: "finito_payment",
	schema: PaymentSchema,
	useEncryption: true,
});
