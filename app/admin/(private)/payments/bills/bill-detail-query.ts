"use client";

import {
	evoluJsonArrayFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { sql } from "kysely";
import { createQuery } from "@/lib/evolu";
import type { Currency, Integer } from "@/lib/shared/types";

export type BillDetail = {
	id: Id;
	deviceId: Id | null;
	deviceName: string | null;
	tableId: Id | null;
	tableLabel: string | null;
	createdAt: string;
	displayId: number;
	label: string | null;
	currency: Currency;
	totalAmount: Integer;
	items: {
		itemId: Id;
		label: string;
		quantity: number;
		totalAmount: Integer;
	}[];
	rates: {
		currency: Currency;
		rate: number;
	}[];
};

export const createBillDetailQuery = (id: Id) =>
	createQuery<BillDetail>((db) =>
		db
			.selectFrom("posBill")
			.leftJoin("device", "device.id", "posBill.deviceId")
			.leftJoin("table", "table.id", "posBill.tableId")
			.leftJoin("posBillItemLine", "posBillItemLine.posBillId", "posBill.id")
			.select(
				(eb) =>
					[
						"posBill.id as id",
						"device.id as deviceId",
						"device.name as deviceName",
						"table.id as tableId",
						"table.label as tableLabel",
						"posBill.createdAt as createdAt",
						"posBill.displayId as displayId",
						"posBill.label as label",
						"posBill.currency as currency",
						eb.fn
							.coalesce(
								eb.fn.sum<Integer>(
									eb
										.case()
										.when("posBillItemLine._tag", "=", "add")
										.then(eb.ref("posBillItemLine.totalAmount"))
										.when("posBillItemLine._tag", "=", "remove")
										.then(
											sql<number>`- ${eb.ref("posBillItemLine.totalAmount")}`,
										)
										.else(0)
										.end(),
								),
								eb.val(0),
							)
							.as("totalAmount"),
						evoluJsonArrayFrom(
							eb
								.selectFrom("posBillItemLine")
								.leftJoin("item", "item.id", "posBillItemLine.itemId")
								.select(
									(eb) =>
										[
											"posBillItemLine.itemId as itemId",
											"item.label as label",
											eb.fn
												.sum<number>(
													eb
														.case()
														.when("posBillItemLine._tag", "=", "add")
														.then(eb.ref("posBillItemLine.quantity"))
														.when("posBillItemLine._tag", "=", "remove")
														.then(
															sql<number>`- ${eb.ref("posBillItemLine.quantity")}`,
														)
														.else(0)
														.end(),
												)
												.as("quantity"),
											eb.fn
												.sum<Integer>(
													eb
														.case()
														.when("posBillItemLine._tag", "=", "add")
														.then(eb.ref("posBillItemLine.totalAmount"))
														.when("posBillItemLine._tag", "=", "remove")
														.then(
															sql<number>`- ${eb.ref("posBillItemLine.totalAmount")}`,
														)
														.else(0)
														.end(),
												)
												.as("totalAmount"),
										] as const,
								)
								.whereRef("posBillItemLine.posBillId", "=", "posBill.id")
								.where("posBillItemLine.isDeleted", "is not", sqliteTrue)
								.where("posBillItemLine.totalAmount", "is not", null)
								.where("posBillItemLine.quantity", "is not", null)
								.where("posBillItemLine._tag", "is not", null)
								.where("posBillItemLine.itemId", "is not", null)
								.where("item.isDeleted", "is not", sqliteTrue)
								.where("item.label", "is not", null)
								.groupBy("posBillItemLine.itemId")
								.having(
									(eb) =>
										eb.fn.sum<number>(
											eb
												.case()
												.when("posBillItemLine._tag", "=", "add")
												.then(eb.ref("posBillItemLine.quantity"))
												.when("posBillItemLine._tag", "=", "remove")
												.then(
													sql<number>`- ${eb.ref("posBillItemLine.quantity")}`,
												)
												.else(0)
												.end(),
										),
									">",
									0,
								)
								.orderBy("item.label", "asc")
								.$narrowType<{
									itemId: KyselyNotNull;
									label: KyselyNotNull;
									quantity: KyselyNotNull;
									totalAmount: KyselyNotNull;
								}>(),
						).as("items"),
						evoluJsonArrayFrom(
							eb
								.selectFrom("posBillRate")
								.select([
									"posBillRate.currency as currency",
									"posBillRate.rate as rate",
								] as const)
								.whereRef("posBillRate.billId", "=", "posBill.id")
								.where("posBillRate.isDeleted", "is not", sqliteTrue)
								.where("posBillRate.currency", "is not", null)
								.where("posBillRate.rate", "is not", null)
								.orderBy("posBillRate.currency", "asc")
								.$narrowType<{
									currency: KyselyNotNull;
									rate: KyselyNotNull;
								}>(),
						).as("rates"),
					] as const,
			)
			.where("posBill.isDeleted", "is not", sqliteTrue)
			.where("posBill.displayId", "is not", null)
			.where("posBill.currency", "is not", null)
			.where("posBill.id", "=", id)
			.groupBy("posBill.id")
			.$narrowType<{
				displayId: KyselyNotNull;
				currency: KyselyNotNull;
				totalAmount: KyselyNotNull;
				items: KyselyNotNull;
				rates: KyselyNotNull;
			}>(),
	);
