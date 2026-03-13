import { createIdFromString } from "@evolu/common";
import type { SetOptional } from "type-fest";
import type { EvoluSchemaType } from "@/lib/evolu";
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

		const itemRevision = convertItemToItemRevision({
			...item,
			id,
		});
		deps.evolu.upsert("itemRevision", itemRevision);

		return { itemRevisionId: itemRevision.id };
	};

export const createItemRevisionId = (
	item: Omit<EvoluSchemaType["itemRevision"], "id">,
) => {
	return createIdFromString(stableStringify(item));
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

export const createItemRevision =
	(deps: EvoluDep) =>
	(params: {
		item: Omit<EvoluSchemaType["itemRevision"], "id">;
	}): EvoluSchemaType["itemRevision"] => {
		const itemRevisionId = createItemRevisionId(params.item);
		const itemRevision = {
			...params.item,
			id: itemRevisionId,
		};

		deps.evolu.upsert("itemRevision", itemRevision);

		return itemRevision;
	};
