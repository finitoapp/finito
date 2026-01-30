import { z } from "zod";
import { NonEmptyStringSchema } from "@/lib/types";
import { PaymentSchema } from "@/storages/payment-storage";

export const StaticOfflinePaymentSchema = PaymentSchema.omit({
	webPaymentEventId: true,
});

export type StaticOfflinePayment = z.output<typeof StaticOfflinePaymentSchema>;

export const AddressSchema = z.object({
	street: NonEmptyStringSchema,
	descriptiveNumber: NonEmptyStringSchema,
	city: NonEmptyStringSchema,
	postalCode: NonEmptyStringSchema,
});

export type Address = z.output<typeof AddressSchema>;
