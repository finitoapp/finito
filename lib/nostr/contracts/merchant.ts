import { z } from "zod";
import { NonEmptyStringSchema, PhoneSchema } from "@/lib/shared/types";

export const MerchantSchema = z.object({
	name: NonEmptyStringSchema,
	description: NonEmptyStringSchema.optional(),
	phone: PhoneSchema.optional(),
});

export const NostrMerchantSchema = z.object({
	version: z.literal(1),
	merchant: MerchantSchema,
});

export type NostrMerchant = z.output<typeof NostrMerchantSchema>;
