import { type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { createQuery } from "@/lib/evolu";

export const getAllCatalogItemsQuery = createQuery((db) =>
	db
		.selectFrom("catalogItem")
		.select([
			"catalogItem.id as id",
			"catalogItem.deviceId as deviceId",
			"catalogItem.label as label",
			"catalogItem.price as price",
			"catalogItem.costPrice as costPrice",
			"catalogItem.currency as currency",
			"catalogItem.unitOfMeasure as unitOfMeasure",
			"catalogItem.internalCode as internalCode",
			"catalogItem.productCodeType as productCodeType",
			"catalogItem.productCodeValue as productCodeValue",
			"catalogItem.categoryId as categoryId",
		] as const)
		.where("catalogItem.isDeleted", "is not", sqliteTrue)
		.where("catalogItem.label", "is not", null)
		.where("catalogItem.price", "is not", null)
		.where("catalogItem.currency", "is not", null)
		.$narrowType<{
			label: KyselyNotNull;
			price: KyselyNotNull;
			currency: KyselyNotNull;
		}>(),
);
