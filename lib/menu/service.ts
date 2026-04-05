import {
	createIdFromString,
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type KyselyNotNull,
	ok,
	type Result,
	sqliteTrue,
	tryAsync,
} from "@evolu/common";
import { createQuery, type Evolu } from "@/lib/evolu";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { menuStorage } from "@/lib/menu/nostr-storage";
import { defineError } from "@/lib/shared/error";
import {
	type TimestampMs,
	Timezone,
	type Timezone as TimezoneType,
} from "@/lib/shared/types";

const createPublishRelevantMenusLoadError = defineError(
	"PublishRelevantMenusLoadError",
)<{
	cause: unknown;
}>();
type PublishRelevantMenusLoadError = ReturnType<
	typeof createPublishRelevantMenusLoadError
>;

const createPublishRelevantMenusWriteError = defineError(
	"PublishRelevantMenusWriteError",
)<{
	cause: unknown;
}>();
type PublishRelevantMenusWriteError = ReturnType<
	typeof createPublishRelevantMenusWriteError
>;

const isKnownTimezone = (
	value: string | null | undefined,
): value is TimezoneType =>
	value === Timezone.UTC || value === Timezone["Europe/Prague"];

type PublishRelevantMenusResult = Result<
	void,
	PublishRelevantMenusLoadError | PublishRelevantMenusWriteError
>;

export const publishRelevantMenusToStorage = async (params: {
	ndk: Parameters<typeof menuStorage.write>[0]["ndk"];
	evolu: Evolu;
	now?: TimestampMs;
}): Promise<PublishRelevantMenusResult> => {
	const now = params.now ?? Date.now();

	const loaded = await tryAsync(
		() =>
			Promise.all([
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

										evoluJsonArrayFrom(
											eb
												.selectFrom("menuCategory")
												.select((eb) => [
													"menuCategory.id as id",
													"menuCategory.name as name",

													evoluJsonArrayFrom(
														eb
															.selectFrom("menuItemLine")
															.select(
																(eb) =>
																	[
																		"menuItemLine.id as id",
																		"menuItemLine.menuCategoryId as menuCategoryId",
																		"menuItemLine.availabilityStatus as availabilityStatus",

																		evoluJsonObjectFrom(
																			eb
																				.selectFrom("item")
																				.select([
																					"item.label as label",
																					"item.price as price",
																					"item.currency as currency",
																					"item.unitOfMeasure as unitOfMeasure",
																					"item.id as id",
																					"item.catalogItemId as itemId",
																				])
																				.whereRef(
																					"item.id",
																					"=",
																					"menuItemLine.itemId",
																				)
																				.where(
																					"item.isDeleted",
																					"is not",
																					sqliteTrue,
																				)
																				.where("item.label", "is not", null)
																				.where("item.price", "is not", null)
																				.where("item.currency", "is not", null)
																				.$narrowType<{
																					label: KyselyNotNull;
																					price: KyselyNotNull;
																					currency: KyselyNotNull;
																				}>(),
																		).as("item"),
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
																item: KyselyNotNull;
															}>(),
													).as("items"),
												])
												.whereRef("menuCategory.menuId", "=", "menu.id")
												.where("menuCategory.isDeleted", "is not", sqliteTrue)
												.where("menuCategory.name", "is not", null)
												.$narrowType<{
													name: KyselyNotNull;
												}>(),
										).as("categories"),
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
								name: KyselyNotNull;
								status: KyselyNotNull;
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
			]),
		(cause) => createPublishRelevantMenusLoadError({ cause }),
	);
	if (!loaded.ok) {
		return loaded;
	}

	const [menuRows, billingSettingsRows] = loaded.value;
	const timezone = isKnownTimezone(billingSettingsRows[0]?.defaultTimezone)
		? billingSettingsRows[0].defaultTimezone
		: Timezone["Europe/Prague"];

	const payload: Parameters<typeof menuStorage.write>[1] = {
		version: 1,
		generatedAt: now,
		payload: {
			timezone,
			generatedAt: now,
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
					return a.name.localeCompare(b.name, undefined, {
						sensitivity: "base",
					});
				}),
		},
	};

	const writeResult = await tryAsync(
		() => menuStorage.write({ ndk: params.ndk }, payload),
		(cause) => createPublishRelevantMenusWriteError({ cause }),
	);
	if (!writeResult.ok) {
		return writeResult;
	}

	return ok();
};
