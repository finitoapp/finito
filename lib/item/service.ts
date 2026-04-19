import { createIdFromString, sqliteTrue } from "@evolu/common";
import { pick } from "es-toolkit";
import type { SetOptional } from "type-fest";
import { createQuery, type EvoluSchemaType } from "@/lib/evolu";
import type { EvoluDep } from "@/lib/shared/dependencies";
import { stableStringify } from "@/lib/shared/utils/json";

type CatalogItemLike = Omit<EvoluSchemaType["catalogItem"], "costPrice"> & {
	costPrice?: EvoluSchemaType["catalogItem"]["costPrice"];
};

export const createCatalogItem =
	(deps: EvoluDep) =>
	({
		catalogItem: { id: catalogItemId, ...catalogItem },
	}: {
		catalogItem: SetOptional<EvoluSchemaType["catalogItem"], "id">;
	}) => {
		const { id } = catalogItemId
			? deps.evolu.upsert("catalogItem", {
					id: catalogItemId,
					...catalogItem,
				})
			: deps.evolu.insert("catalogItem", catalogItem);

		return {
			...catalogItem,
			id,
		};
	};

export const createItemId = (
	item: Omit<EvoluSchemaType["item"], "id" | "catalogItemId">,
) => {
	return createIdFromString(
		stableStringify(
			pick(item, [
				"label",
				"price",
				"unitOfMeasure",
				"internalCode",
				"productCodeType",
				"productCodeValue",
				"categoryId",
				"currency",
			]),
		),
	);
};

export const convertCatalogItemToItem = ({
	id,
	costPrice: _costPrice,
	...item
}: CatalogItemLike): EvoluSchemaType["item"] => {
	return {
		...item,
		id: createItemId(item),
		catalogItemId: id,
	};
};

export const createItemFromCatalogItem =
	(deps: EvoluDep) =>
	async (params: {
		catalogItem: CatalogItemLike;
	}): Promise<EvoluSchemaType["item"]> => {
		const { id, costPrice: _costPrice, ...item } = params.catalogItem;

		return await createItem(deps)({
			item: {
				...item,
				catalogItemId: id,
			},
		});
	};

export const createItem =
	(deps: EvoluDep) =>
	async (params: {
		item: Omit<EvoluSchemaType["item"], "id">;
	}): Promise<EvoluSchemaType["item"]> => {
		const itemId = createItemId(params.item);

		const existingItem = await deps.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("item")
					.select(["item.id as id"] as const)
					.where("item.isDeleted", "is not", sqliteTrue)
					.where("item.id", "=", itemId),
			),
		);

		const item = {
			...params.item,
			id: itemId,
		};

		if (existingItem.length === 0) {
			deps.evolu.upsert("item", item);
		}

		return item;
	};
