import { z } from "zod";
import {
	Currency,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	TimestampMsSchema,
	Timezone,
} from "@/lib/types";

const MenuItemPublicSchema = z.object({
	// Internal Evolu row id intentionally reused as stable public identifier.
	id: NonEmptyStringSchema,
	label: NonEmptyStringSchema,
	// Optional UI hint for visually marking sold-out items.
	isSoldOut: z.boolean().optional(),
	// Stored in minor units for `priceCurrency` (same convention as Evolu).
	priceValue: NonNegativeIntegerSchema,
	priceCurrency: z.enum(Currency),
	unitOfMeasure: NonEmptyStringSchema.optional(),
});

const MenuCategoryPublicSchema = z.object({
	id: NonEmptyStringSchema,
	name: NonEmptyStringSchema,
	// Sorted by `label` ascending.
	items: z.array(MenuItemPublicSchema),
});

const MenuPublicSchema = z.object({
	id: NonEmptyStringSchema,
	name: NonEmptyStringSchema,
	// Only published + currently valid menus should be exported.
	// `status` is omitted because the contract includes only published menus.
	validFrom: TimestampMsSchema.optional(),
	validTo: TimestampMsSchema.optional(),
	publishedAt: TimestampMsSchema.optional(),
	// Categories should be sorted by `name` ascending.
	categories: z.array(MenuCategoryPublicSchema),
});

export const NostrMenu = z.object({
	version: z.literal(1),
	generatedAt: TimestampMsSchema,
	// IANA timezone string used to interpret validity windows (e.g. Europe/Prague).
	timezone: z.enum(Timezone),
	// Sorted by:
	// 1) `validTo` ascending (earliest ending first)
	// 2) menus without `validTo` last
	// 3) `name` ascending as tie-breaker
	menus: z.array(MenuPublicSchema),
});

export type NostrMenu = z.output<typeof NostrMenu>;
