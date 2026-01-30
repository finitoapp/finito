import { z } from "zod";
import { Currency, NonEmptyStringSchema, ProductCodeType } from "@/lib/types";

export const ItemSchema = z.object({
	id: z.string(),
	label: NonEmptyStringSchema,
	priceValue: z.number(),
	priceCurrency: z.enum(Currency),
	unitOfMeasure: NonEmptyStringSchema.nullable(),
	internalCode: NonEmptyStringSchema.nullable(),
	productCodeType: z.enum(ProductCodeType).nullable(),
	productCodeValue: NonEmptyStringSchema.nullable(),
});
