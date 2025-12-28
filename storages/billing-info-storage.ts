import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { NonEmptyStringSchema } from "@/lib/types";
import {
	ClientCountrySpecificCZSchema,
	ClientSchema,
} from "@/storages/client-storage";

export const BillingInfoSchema = ClientSchema.omit({
	countrySpecific: true,
}).extend({
	countrySpecific: z.union([
		ClientCountrySpecificCZSchema.pick({
			countryCode: true,
		}).extend({
			vatPayer: z.literal(true),
			vatNumber: NonEmptyStringSchema,
			identificationNumber: NonEmptyStringSchema,
			caseNumber: NonEmptyStringSchema,
		}),
		ClientCountrySpecificCZSchema.pick({
			countryCode: true,
		}).extend({
			vatPayer: z.literal(false),
			vatNumber: NonEmptyStringSchema.optional(),
			identificationNumber: NonEmptyStringSchema,
			caseNumber: NonEmptyStringSchema.optional(),
		}),
	]),
});

export type BillingInfo = z.output<typeof BillingInfoSchema>;

export const billingInfoStorage = createNostrStorage({
	namespace: "finito_billing_info",
	schema: BillingInfoSchema,
	useEncryption: true,
});
