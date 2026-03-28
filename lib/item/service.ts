import { createIdFromString, sqliteTrue } from "@evolu/common";
import { pick } from "es-toolkit";
import type { SetOptional } from "type-fest";
import { createQuery, type EvoluSchemaType } from "@/lib/evolu";
import type { EvoluDep } from "@/lib/shared/dependencies";
import { stableStringify } from "@/lib/shared/utils/json";

export const createItem =
	(deps: EvoluDep) =>
	({
		item: { id: itemId, ...item },
	}: {
		item: SetOptional<EvoluSchemaType["item"], "id">;
	}) => {
		const { id } = itemId
			? deps.evolu.upsert("item", {
					id: itemId,
					...item,
				})
			: deps.evolu.insert("item", item);

		return {
			...item,
			id,
		};
	};

export const createItemRevisionId = (
	item: Omit<EvoluSchemaType["itemRevision"], "id">,
) => {
	return createIdFromString(
		stableStringify(
			pick(item, [
				"deviceId",
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

export const convertItemToItemRevision = ({
	id,
	...item
}: EvoluSchemaType["item"]): EvoluSchemaType["itemRevision"] => {
	const data = {
		...item,
		itemId: id,
	};

	return {
		...data,
		id: createItemRevisionId(data),
	};
};

export const createItemRevisionFromItem =
	(deps: EvoluDep) =>
	async (params: {
		item: EvoluSchemaType["item"];
	}): Promise<EvoluSchemaType["itemRevision"]> => {
		return await createItemRevision(deps)({
			item: {
				...params.item,
				itemId: params.item.id,
			},
		});
	};

export const createItemRevision =
	(deps: EvoluDep) =>
	async (params: {
		item: Omit<EvoluSchemaType["itemRevision"], "id">;
	}): Promise<EvoluSchemaType["itemRevision"]> => {
		const itemRevisionId = createItemRevisionId(params.item);

		const existingItem = await deps.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("itemRevision")
					.select(["itemRevision.id as id"] as const)
					.where("itemRevision.isDeleted", "is not", sqliteTrue)
					.where("itemRevision.id", "=", itemRevisionId),
			),
		);

		const itemRevision = {
			...params.item,
			id: itemRevisionId,
		};

		if (existingItem.length === 0) {
			deps.evolu.upsert("itemRevision", itemRevision);
		}

		return itemRevision;
	};
