import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { Currency, NonEmptyStringSchema, ProductCodeType } from "@/lib/types";

export const ItemSchema = z.object({
	id: z.string(),
	label: NonEmptyStringSchema,
	price: z.object({
		value: z.number(),
		currency: z.enum(Currency),
	}),
	unitOfMeasure: NonEmptyStringSchema.optional(),
	internalCode: NonEmptyStringSchema.optional(),
	productCode: z
		.object({
			type: z.enum(ProductCodeType),
			code: NonEmptyStringSchema,
		})
		.optional(),
});

export type Item = z.output<typeof ItemSchema>;

export const itemStorage = createNostrStorage({
	namespace: "finito_item",
	schema: ItemSchema,
	useEncryption: true,
});
