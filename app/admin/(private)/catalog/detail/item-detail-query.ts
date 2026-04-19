"use client";

import {
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { createQuery } from "@/lib/evolu";

export const createItemDetailQuery = (id: Id) =>
	createQuery((db) => {
		return db
			.selectFrom("catalogItem")
			.select(
				(eb) =>
					[
						"catalogItem.id as id",
						"catalogItem.deviceId as deviceId",
						"catalogItem.label as label",
						"catalogItem.price as price",
						"catalogItem.costPrice as costPrice",
						"catalogItem.currency as currency",
						"catalogItem.unitOfMeasure as unitOfMeasure",
						"catalogItem.categoryId as categoryId",
						"catalogItem.productCodeType as productCodeType",
						"catalogItem.productCodeValue as productCodeValue",
						"catalogItem.internalCode as internalCode",
						"catalogItem.createdAt as createdAt",
						"catalogItem.updatedAt as updatedAt",

						evoluJsonObjectFrom(
							eb
								.selectFrom("category")
								.select(["category.name as name"])
								.whereRef("category.id", "=", "catalogItem.categoryId")
								.where("category.name", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
								}>(),
						).as("category"),
					] as const,
			)
			.where("catalogItem.isDeleted", "is not", sqliteTrue)
			.where("catalogItem.price", "is not", null)
			.where("catalogItem.currency", "is not", null)
			.where("catalogItem.id", "=", id)
			.$narrowType<{
				label: KyselyNotNull;
				price: KyselyNotNull;
				currency: KyselyNotNull;
			}>();
	});
