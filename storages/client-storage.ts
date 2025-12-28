import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
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
	id: z.string(),
	name: NonEmptyStringSchema, // Company name
	label: NonEmptyStringSchema.optional(), // Custom name for private purposes
	email: EmailSchema.optional(),
	address: AddressSchema.optional(),
	countrySpecific: z.discriminatedUnion("countryCode", [
		ClientCountrySpecificCZSchema,
	]),
});

export type Client = z.output<typeof ClientSchema>;

export const clientStorage = createNostrStorage({
	namespace: "finito_client",
	schema: ClientSchema,
	useEncryption: true,
});
