import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import {
	EmailSchema,
	FiatCurrency,
	IbanSchema,
	NonEmptyStringSchema,
} from "@/lib/types";

export const AccountSchema = z.intersection(
	z.object({
		id: z.string(),
		name: NonEmptyStringSchema,
	}),
	z.discriminatedUnion("_tag", [
		z.object({
			_tag: z.literal("iban"),
			iban: IbanSchema,
			currency: z.enum(FiatCurrency),
		}),
		z.object({
			_tag: z.literal("lud16"),
			lud16: EmailSchema,
		}),
		z.object({
			_tag: z.literal("spark"),
			mnemonic: NonEmptyStringSchema,
		}),
		z.object({
			_tag: z.literal("cash_register"),
			currency: z.enum(FiatCurrency),
		}),
	]),
);

export type Account = z.output<typeof AccountSchema>;

export const accountStorage = createNostrStorage({
	namespace: "finito_account",
	schema: AccountSchema,
	useEncryption: true,
});
