import { type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { createQuery } from "@/lib/evolu";

export const getAllItemsQuery = createQuery((db) =>
	db
		.selectFrom("item")
		.select([
			"item.id as id",
			"item.deviceId as deviceId",
			"item.label as label",
			"item.price as price",
			"item.currency as currency",
			"item.unitOfMeasure as unitOfMeasure",
			"item.internalCode as internalCode",
			"item.productCodeType as productCodeType",
			"item.productCodeValue as productCodeValue",
			"item.categoryId as categoryId",
		] as const)
		.where("item.isDeleted", "is not", sqliteTrue)
		.where("item.label", "is not", null)
		.where("item.price", "is not", null)
		.where("item.currency", "is not", null)
		.$narrowType<{
			label: KyselyNotNull;
			price: KyselyNotNull;
			currency: KyselyNotNull;
		}>(),
);
