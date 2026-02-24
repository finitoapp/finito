import { z } from "zod";
import { NonEmptyStringSchema } from "@/lib/shared/types";
import { PaymentSchema } from "@/lib/evolu/model/payment";

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
