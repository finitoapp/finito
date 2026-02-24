import { z } from "zod";
import { NonEmptyStringSchema } from "@/lib/shared/types";
import {
	ClientCountrySpecificCZSchema,
	ClientSchema,
} from "@/lib/evolu/model/client";

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
