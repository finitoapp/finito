import { createIdFromString, sqliteTrue } from "@evolu/common";
import * as errore from "errore";
import type { Evolu } from "@/lib/evolu";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { menuStorage } from "@/lib/menu/nostr-storage";
import { Timezone, type Timezone as TimezoneType } from "@/lib/shared/types";

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
	now?: number;
}): Promise<PublishRelevantMenusResult> => {
	const now = params.now ?? Date.now();

	const loaded = await Promise.all([
		params.evolu.loadQuery(
			params.evolu.createQuery((db) =>
				db
					.selectFrom("menu")
					.select([
						"menu.id as id",
						"menu.name as name",
						"menu.status as status",
						"menu.validFrom as validFrom",
						"menu.validTo as validTo",
						"menu.publishedAt as publishedAt",
					] as const)
					.where("menu.isDeleted", "is not", sqliteTrue)
					.where("menu.status", "=", MenuStatus.Published)
					.where((eb) =>
						eb.or([
							eb("menu.validTo", "is", null),
							eb("menu.validTo", ">=", now),
						]),
					),
			),
		),
		params.evolu.loadQuery(
			params.evolu.createQuery((db) =>
				db
					.selectFrom("menuCategory")
					.select([
						"menuCategory.id as id",
						"menuCategory.menuId as menuId",
						"menuCategory.name as name",
					] as const)
					.where("menuCategory.isDeleted", "is not", sqliteTrue),
			),
		),
		params.evolu.loadQuery(
			params.evolu.createQuery((db) =>
				db
					.selectFrom("menuItem")
					.innerJoin(
						"menuCategory",
						"menuCategory.id",
						"menuItem.menuCategoryId",
					)
					.select([
						"menuItem.id as id",
						"menuItem.menuCategoryId as menuCategoryId",
						"menuItem.label as label",
						"menuItem.availabilityStatus as availabilityStatus",
						"menuItem.priceValue as priceValue",
						"menuItem.priceCurrency as priceCurrency",
						"menuItem.unitOfMeasure as unitOfMeasure",
					] as const)
					.where("menuItem.isDeleted", "is not", sqliteTrue)
					.where("menuCategory.isDeleted", "is not", sqliteTrue),
			),
		),
		params.evolu.loadQuery(
			params.evolu.createQuery((db) =>
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

	const [menuRows, categoryRows, itemRows, billingSettingsRows] = loaded;
	const timezone = isKnownTimezone(billingSettingsRows[0]?.defaultTimezone)
		? billingSettingsRows[0].defaultTimezone
		: Timezone["Europe/Prague"];

	const relevantMenus = menuRows;

	const relevantMenuIds = new Set(relevantMenus.map((menu) => menu.id));
	const categoriesByMenuId = new Map<
		string,
		Array<{
			id: string;
			name: string;
			items: Array<{
				id: string;
				label: string;
				availabilityStatus: string | null;
				priceValue: number;
				priceCurrency: string;
				unitOfMeasure: string | null;
			}>;
		}>
	>();
	const categoryIndex = new Map<string, { menuId: string; index: number }>();

	for (const category of categoryRows) {
		if (category.name === null) continue;
		if (!relevantMenuIds.has(category.menuId)) continue;

		const menuCategories = categoriesByMenuId.get(category.menuId) ?? [];
		const index =
			menuCategories.push({
				id: category.id,
				name: category.name,
				items: [],
			}) - 1;
		categoriesByMenuId.set(category.menuId, menuCategories);
		categoryIndex.set(category.id, { menuId: category.menuId, index });
	}

	for (const item of itemRows) {
		if (
			item.label === null ||
			item.priceValue === null ||
			item.priceCurrency === null ||
			item.availabilityStatus === "hidden"
		) {
			continue;
		}

		const categoryRef = categoryIndex.get(item.menuCategoryId);
		if (!categoryRef) continue;

		const categories = categoriesByMenuId.get(categoryRef.menuId);
		const category = categories?.[categoryRef.index];
		if (!category) continue;

		category.items.push({
			id: item.id,
			label: item.label,
			availabilityStatus: item.availabilityStatus,
			priceValue: item.priceValue,
			priceCurrency: item.priceCurrency,
			unitOfMeasure: item.unitOfMeasure,
		});
	}

	const payload: Parameters<typeof menuStorage.write>[1] = {
		version: 1,
		generatedAt: now,
		timezone,
		menus: relevantMenus
			.map((menu) => ({
				id: menu.id,
				name: menu.name,
				validFrom: menu.validFrom ?? undefined,
				validTo: menu.validTo ?? undefined,
				publishedAt: menu.publishedAt ?? undefined,
				categories: (categoriesByMenuId.get(menu.id) ?? [])
					.map((category) => ({
						id: category.id,
						name: category.name,
						items: [...category.items]
							.sort((a, b) =>
								a.label.localeCompare(b.label, undefined, {
									sensitivity: "base",
								}),
							)
							.map((item) => ({
								id: item.id,
								label: item.label,
								isSoldOut:
									item.availabilityStatus === "soldOut" ? true : undefined,
								priceValue: item.priceValue,
								priceCurrency: item.priceCurrency,
								unitOfMeasure: item.unitOfMeasure ?? undefined,
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
