import { createIdFromString, kysely, sqliteTrue } from "@evolu/common";
import * as errore from "errore";
import type { NotNull } from "kysely";
import { createQuery, type Evolu } from "@/lib/evolu";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { menuStorage } from "@/lib/menu/nostr-storage";
import {
	type TimestampMs,
	Timezone,
	type Timezone as TimezoneType,
} from "@/lib/shared/types";

export class PublishRelevantMenusLoadError extends errore.createTaggedError({
	name: "PublishRelevantMenusLoadError",
	message: "Failed to load menus for Nostr publish",
}) {}

export class PublishRelevantMenusWriteError extends errore.createTaggedError({
	name: "PublishRelevantMenusWriteError",
	message: "Failed to publish menus to Nostr storage",
}) {}

const isKnownTimezone = (
	value: string | null | undefined,
): value is TimezoneType =>
	value === Timezone.UTC || value === Timezone["Europe/Prague"];

type PublishRelevantMenusResult =
	| undefined
	| PublishRelevantMenusLoadError
	| PublishRelevantMenusWriteError;

export const publishRelevantMenusToStorage = async (params: {
	ndk: Parameters<typeof menuStorage.write>[0]["ndk"];
	evolu: Evolu;
	now?: TimestampMs;
}): Promise<PublishRelevantMenusResult> => {
	const now = params.now ?? Date.now();

	const loaded = await Promise.all([
		params.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("menu")
					.select(
						(eb) =>
							[
								"menu.id as id",
								"menu.name as name",
								"menu.status as status",
								"menu.validFrom as validFrom",
								"menu.validTo as validTo",
								"menu.publishedAt as publishedAt",

								kysely
									.jsonArrayFrom(
										eb
											.selectFrom("menuCategory")
											.select((eb) => [
												"menuCategory.id as id",
												"menuCategory.name as name",

												kysely
													.jsonArrayFrom(
														eb
															.selectFrom("menuItemLine")
															.select(
																(eb) =>
																	[
																		"menuItemLine.id as id",
																		"menuItemLine.menuCategoryId as menuCategoryId",
																		"menuItemLine.availabilityStatus as availabilityStatus",

																		kysely
																			.jsonObjectFrom(
																				eb
																					.selectFrom("menuItem")
																					.select([
																						"menuItem.label as label",
																						"menuItem.price as price",
																						"menuItem.currency as currency",
																						"menuItem.unitOfMeasure as unitOfMeasure",
																						"menuItem.id as id",
																						"menuItem.sourceItemId as sourceItemId",
																					])
																					.whereRef(
																						"menuItem.id",
																						"=",
																						"menuItemLine.id",
																					)
																					.where(
																						"menuItem.isDeleted",
																						"is not",
																						sqliteTrue,
																					)
																					.where(
																						"menuItem.label",
																						"is not",
																						null,
																					)
																					.where(
																						"menuItem.price",
																						"is not",
																						null,
																					)
																					.where(
																						"menuItem.currency",
																						"is not",
																						null,
																					)
																					.$narrowType<{
																						label: NotNull;
																						price: NotNull;
																						currency: NotNull;
																					}>(),
																			)
																			.as("item"),
																	] as const,
															)
															.whereRef(
																"menuItemLine.menuCategoryId",
																"=",
																"menuCategory.id",
															)
															.where(
																"menuItemLine.isDeleted",
																"is not",
																sqliteTrue,
															)
															.$narrowType<{
																item: NotNull;
															}>(),
													)
													.as("items"),
											])
											.whereRef("menuCategory.menuId", "=", "menu.id")
											.where("menuCategory.isDeleted", "is not", sqliteTrue)
											.where("menuCategory.name", "is not", null)
											.$narrowType<{
												name: NotNull;
											}>(),
									)
									.as("categories"),
							] as const,
					)
					.where("menu.isDeleted", "is not", sqliteTrue)
					.where("menu.name", "is not", null)
					.where("menu.status", "=", MenuStatus.Published)
					.where((eb) =>
						eb.or([
							eb("menu.validTo", "is", null),
							eb("menu.validTo", ">=", now),
						]),
					)
					.$narrowType<{
						name: NotNull;
						status: NotNull;
					}>(),
			),
		),
		params.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("billingSettings")
					.select([
						"billingSettings.defaultTimezone as defaultTimezone",
					] as const)
					.where("billingSettings.isDeleted", "is not", sqliteTrue)
					.where("billingSettings.id", "=", createIdFromString("")),
			),
		),
	]).catch((cause) => new PublishRelevantMenusLoadError({ cause }));
	if (loaded instanceof Error) {
		return loaded;
	}

	const [menuRows, billingSettingsRows] = loaded;
	const timezone = isKnownTimezone(billingSettingsRows[0]?.defaultTimezone)
		? billingSettingsRows[0].defaultTimezone
		: Timezone["Europe/Prague"];

	const payload: Parameters<typeof menuStorage.write>[1] = {
		version: 1,
		generatedAt: now,
		timezone,
		menus: menuRows
			.map((menu) => ({
				id: menu.id,
				name: menu.name,
				validFrom: menu.validFrom ?? undefined,
				validTo: menu.validTo ?? undefined,
				publishedAt: menu.publishedAt ?? undefined,
				categories: menu.categories
					.map((category) => ({
						id: category.id,
						name: category.name,
						items: category.items
							.sort((a, b) =>
								a.item.label.localeCompare(b.item.label, undefined, {
									sensitivity: "base",
								}),
							)
							.map((item) => ({
								id: item.id,
								label: item.item.label,
								isSoldOut:
									item.availabilityStatus === "soldOut" ? true : undefined,
								price: item.item.price,
								currency: item.item.currency,
								unitOfMeasure: item.item.unitOfMeasure ?? undefined,
							})),
					}))
					.filter((category) => category.items.length > 0)
					.sort((a, b) =>
						a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
					),
			}))
			.sort((a, b) => {
				if (a.validTo === undefined && b.validTo === undefined) {
					return a.name.localeCompare(b.name, undefined, {
						sensitivity: "base",
					});
				}
				if (a.validTo === undefined) return 1;
				if (b.validTo === undefined) return -1;
				if (a.validTo !== b.validTo) return a.validTo - b.validTo;
				return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
			}),
	};

	const writeResult = await menuStorage
		.write({ ndk: params.ndk }, payload)
		.catch((cause) => new PublishRelevantMenusWriteError({ cause }));
	if (writeResult instanceof Error) {
		return writeResult;
	}

	return undefined;
};
