import { z } from "zod";
import { AddressSchema } from "@/lib/schemas";
import {
	CountryCode,
	EmailSchema,
	IdentificationNumberCzSchema,
	NonEmptyStringSchema,
} from "@/lib/types";

export const ClientCountrySpecificCZSchema = z.object({
	countryCode: z.literal(CountryCode.CZ),
	identificationNumber: IdentificationNumberCzSchema.optional(),
	vatNumber: NonEmptyStringSchema.optional(),
	caseNumber: NonEmptyStringSchema.optional(),
});

export const ClientSchema = z.object({
	name: NonEmptyStringSchema, // Company name
	label: NonEmptyStringSchema.nullable(), // Custom name for private purposes
	email: EmailSchema.nullable(),
	address: AddressSchema.nullable(),
	countryCode: z.literal(CountryCode.CZ),
	countrySpecific: z.discriminatedUnion("countryCode", [
		ClientCountrySpecificCZSchema,
	]),
});
