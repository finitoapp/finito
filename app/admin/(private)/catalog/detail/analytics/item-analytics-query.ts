"use client";

import {
	type DateIso,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { createQuery } from "@/lib/evolu";
import type { Currency, Integer } from "@/lib/shared/types";

export type ItemSalesRow = {
	paymentId: Id;
	createdAt: DateIso;
	quantity: number;
	totalAmount: Integer;
	currency: Currency;
};

export const createItemSalesQuery = (itemId: Id) =>
	createQuery((db) =>
		db
			.selectFrom("paymentItemLine")
			.innerJoin("payment", "payment.id", "paymentItemLine.paymentId")
			.select([
				"payment.id as paymentId",
				"payment.createdAt as createdAt",
				"payment.currency as currency",
				"paymentItemLine.quantity as quantity",
				"paymentItemLine.totalAmount as totalAmount",
			] as const)
			.where("paymentItemLine.isDeleted", "is not", sqliteTrue)
			.where("payment.isDeleted", "is not", sqliteTrue)
			.where("payment.direction", "=", "incoming")
			.where("payment.createdAt", "is not", null)
			.where("payment.currency", "is not", null)
			.where("paymentItemLine.quantity", "is not", null)
			.where("paymentItemLine.totalAmount", "is not", null)
			.where((eb) => eb("paymentItemLine.itemId", "=", itemId))
			.orderBy("payment.createdAt", "asc")
			.$narrowType<{
				createdAt: KyselyNotNull;
				currency: KyselyNotNull;
				quantity: KyselyNotNull;
				totalAmount: KyselyNotNull;
			}>(),
	);
