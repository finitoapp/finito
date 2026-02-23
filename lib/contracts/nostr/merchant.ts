import { z } from "zod";
import { NonEmptyStringSchema, PhoneSchema } from "@/lib/types";

export const NostrMerchantSchema = z.object({
	version: z.literal(1),
	merchant: z.object({
		name: NonEmptyStringSchema,
		description: NonEmptyStringSchema.optional(),
		phone: PhoneSchema.optional(),
	}),
});

export type NostrMerchant = z.output<typeof NostrMerchantSchema>;
