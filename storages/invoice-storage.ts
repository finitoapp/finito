import { z } from "zod";
import { AddressSchema } from "@/lib/schemas";
import {
	Currency,
	DateStringSchema,
	IbanSchema,
	type InferEnumType,
	NonEmptyStringSchema,
	Uuid7Schema,
} from "@/lib/types";
import { BillingInfoSchema } from "@/storages/billing-info-storage";
import { ClientSchema } from "@/storages/client-storage";
import { ItemSchema } from "@/storages/item-storage";

export const InvoicePaymentMethod = {
	BankTransfer: "bankTransfer",
	Cash: "cash",
	PaymentCard: "paymentCard",
} as const;
export type InvoicePaymentMethod = InferEnumType<typeof InvoicePaymentMethod>;

export const InvoiceSchema = z.object({
	invoiceId: Uuid7Schema, // Uuid is required by isdoc spec. (http://www.isdoc.cz/)
	invoiceNumber: NonEmptyStringSchema,
	payment: z.discriminatedUnion("method", [
		z.object({
			method: z.literal(InvoicePaymentMethod.BankTransfer),
			iban: IbanSchema,
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.PaymentCard),
			iban: IbanSchema.optional(),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.Cash),
		}),
	]),
	supplier: z.object({
		billingInfo: BillingInfoSchema.omit({ address: true }).extend({
			address: AddressSchema,
		}),
	}),
	customer: z.object({
		billingInfo: ClientSchema.omit({ address: true }).extend({
			address: AddressSchema,
		}),
	}),
	issueDate: DateStringSchema,
	dueDate: DateStringSchema,
	currency: z.enum(Currency),
	items: ItemSchema.pick({
		label: true,
		unitOfMeasure: true,
	})
		.extend({
			price: z.number(),
			quantity: z.number(),
		})
		.array(),
});

export type Invoice = z.output<typeof InvoiceSchema>;
