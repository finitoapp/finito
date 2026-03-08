import { z } from "zod";
import {
	Currency,
	HttpsUrlSchema,
	IbanSchema,
	type InferEnumType,
	NonEmptyString32Schema,
	NonEmptyString255Schema,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	PhoneSchema,
} from "@/lib/shared/types";
import {
	epochMillisToDateCodec,
	integerStringToInteger,
} from "@/lib/shared/zod/codecs";

export const PaymentMethod = {
	BankTransferCZ: "bankTransferCZ",
	Cash: "cash",
	LnZap: "lnZap",
	LnSpark: "lnSpark",
} as const;
export type PaymentMethod = InferEnumType<typeof PaymentMethod>;

const BillItemSchema = z.object({
	id: z.string(),
	price: integerStringToInteger,
	quantity: z.number(),
	label: z.string(),
	optionality: z
		.object({
			checked: NonNegativeIntegerSchema,
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
	street: NonEmptyString255Schema.nullable(),
	descriptiveNumber: NonEmptyString32Schema.nullable(),
	city: NonEmptyString255Schema.nullable(),
	postalCode: NonEmptyString32Schema.nullable(),
});
export type Address = z.output<typeof AddressSchema>;

export const PaymentMerchantSchema = z.object({
	name: NonEmptyStringSchema,
	businessAddress: AddressSchema.optional(),
	// officeAddress: AddressSchema.optional(),
	phone: PhoneSchema.optional(),
});

export type PaymentMerchant = z.output<typeof PaymentMerchantSchema>;

export const PaymentSchema = z.object({
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
				accountId: z.string().optional(),
				lnInvoice: NonEmptyStringSchema,
				walletPubkey: z.string(),
				amount: integerStringToInteger,
				expirationIn: epochMillisToDateCodec,
			}),
			z.object({
				type: z.literal("lnSpark"),
				accountId: z.string(),
				lnInvoice: NonEmptyStringSchema,
				sparkInvoiceId: z.string(),
				amount: integerStringToInteger,
				expirationIn: epochMillisToDateCodec,
			}),
			z.object({
				type: z.literal("bankTransferCZ"),
				iban: IbanSchema,
				variableSymbol: z.string(),
			}),
			z.object({
				type: z.literal("cash"),
				accountId: z.string().optional(),
			}),
		])
		.array()
		.optional()
		.default([]),
	privateKey: NonEmptyStringSchema,
	webPaymentEventId: z.string(),
});
