import { type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { createQuery } from "@/lib/evolu";

export const activeCategoriesQuery = createQuery((db) =>
	db
		.selectFrom("category")
		.select(["category.id as id", "category.name as name"])
		.where("category.isDeleted", "is not", sqliteTrue)
		.where("category.name", "is not", null)
		.orderBy("category.name", "asc")
		.$narrowType<{
			name: KyselyNotNull;
		}>(),
);
