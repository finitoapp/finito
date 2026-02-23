import { z } from "zod";
import { Id } from "@/lib/evolu-types";
import {
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	TimestampMsSchema,
	Timezone,
} from "@/lib/types";

// App-specific addressable event kind (NIP-01/NIP-33 style usage).
// One event per publisher pubkey + d-tag snapshot key.
export const MenuSnapshotNostrKind = 30315;
export const MenuSnapshotNostrDTag = "menus";

const MenuItemPublicSchema = z.object({
	// Internal Evolu row id intentionally reused as stable public identifier.
	id: Id,
	label: NonEmptyStringSchema,
	// Stored in minor units for `priceCurrency` (same convention as Evolu).
	priceValue: NonNegativeIntegerSchema,
	priceCurrency: NonEmptyStringSchema,
	unitOfMeasure: NonEmptyStringSchema.optional(),
});

const MenuCategoryPublicSchema = z.object({
	id: Id,
	name: NonEmptyStringSchema,
	// Sorted by `label` ascending.
	items: z.array(MenuItemPublicSchema),
});

const MenuPublicSchema = z.object({
	id: Id,
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
	timezone: Timezone,
	// Sorted by:
	// 1) `validTo` ascending (earliest ending first)
	// 2) menus without `validTo` last
	// 3) `name` ascending as tie-breaker
	menus: z.array(MenuPublicSchema),
});

export type NostrMenu = z.output<typeof NostrMenu>;
