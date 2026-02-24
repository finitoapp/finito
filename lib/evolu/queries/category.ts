import type { Query } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import type { Evolu } from "@/lib/evolu";

export type ActiveCategoryRow = {
	id: string;
	name: string | null;
};

export const createActiveCategoriesQuery = (
	evolu: Pick<Evolu, "createQuery">,
): Query<ActiveCategoryRow> =>
	evolu.createQuery((db) =>
		db
			.selectFrom("category")
			.select(["category.id as id", "category.name as name"])
			.where("category.isDeleted", "is not", sqliteTrue)
			.orderBy("category.name", "asc"),
	);
