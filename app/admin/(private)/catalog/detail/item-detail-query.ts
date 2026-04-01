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
			.selectFrom("item")
			.select(
				(eb) =>
					[
						"item.id as id",
						"item.deviceId as deviceId",
						"item.label as label",
						"item.price as price",
						"item.currency as currency",
						"item.unitOfMeasure as unitOfMeasure",
						"item.categoryId as categoryId",
						"item.productCodeType as productCodeType",
						"item.productCodeValue as productCodeValue",
						"item.internalCode as internalCode",
						"item.createdAt as createdAt",
						"item.updatedAt as updatedAt",

						evoluJsonObjectFrom(
							eb
								.selectFrom("category")
								.select(["category.name as name"])
								.whereRef("category.id", "=", "item.categoryId")
								.where("category.name", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
								}>(),
						).as("category"),
					] as const,
			)
			.where("item.isDeleted", "is not", sqliteTrue)
			.where("item.price", "is not", null)
			.where("item.currency", "is not", null)
			.where("item.id", "=", id)
			.$narrowType<{
				label: KyselyNotNull;
				price: KyselyNotNull;
				currency: KyselyNotNull;
			}>();
	});
