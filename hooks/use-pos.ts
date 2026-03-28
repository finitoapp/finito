import {
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery, type EvoluSchemaType } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";

export type PosBill = EvoluSchemaType["posBill"] & {
	table: Pick<EvoluSchemaType["table"], "id" | "label"> | null;
	items: (Omit<
		EvoluSchemaType["posBillItemLine"],
		"posBillId" | "itemRevisionId" | "itemId"
	> & {
		item: Pick<
			EvoluSchemaType["itemRevision"],
			"label" | "price" | "currency" | "id" | "itemId"
		>;
	})[];
	rates: EvoluSchemaType["posBillRate"][];
};

export type BillRows = {
	billRows: ReadonlyArray<PosBill>;
};

export type Pos = {
	bills: Record<Id, PosBill>;
};

const posBillQuery = createQuery<PosBill>((db) =>
	db
		.selectFrom("posBill")
		.select(
			(eb) =>
				[
					"posBill.id as id",
					"posBill.deviceId as deviceId",
					"posBill.displayId as displayId",
					"posBill.label as label",
					"posBill.currency as currency",
					"posBill.tableId as tableId",

					evoluJsonObjectFrom(
						eb
							.selectFrom("table")
							.select(["table.id as id", "table.label as label"])
							.whereRef("posBill.tableId", "=", "table.id")
							.where("table.isDeleted", "is not", sqliteTrue)
							.where("table.label", "is not", null)
							.$narrowType<{
								label: KyselyNotNull;
							}>(),
					).as("table"),

					evoluJsonArrayFrom(
						eb
							.selectFrom("posBillItemLine")
							.select(
								(eb) =>
									[
										"posBillItemLine.id as id",
										"posBillItemLine.totalAmount as totalAmount",
										"posBillItemLine.quantity as quantity",

										evoluJsonObjectFrom(
											eb
												.selectFrom("itemRevision")
												.select([
													"itemRevision.label as label",
													"itemRevision.price as price",
													"itemRevision.currency as currency",
													"itemRevision.id as id",
													"itemRevision.itemId as itemId",
												])
												.whereRef(
													"itemRevision.id",
													"=",
													"posBillItemLine.itemRevisionId",
												)
												.where("itemRevision.isDeleted", "is not", sqliteTrue)
												.where("itemRevision.label", "is not", null)
												.where("itemRevision.price", "is not", null)
												.where("itemRevision.currency", "is not", null)
												.$narrowType<{
													label: KyselyNotNull;
													price: KyselyNotNull;
													currency: KyselyNotNull;
												}>(),
										).as("item"),
									] as const,
							)
							.whereRef("posBillItemLine.posBillId", "=", "posBill.id")
							.where("posBillItemLine.isDeleted", "is not", sqliteTrue)
							.where("posBillItemLine.totalAmount", "is not", null)
							.where("posBillItemLine.quantity", "is not", null)
							.$narrowType<{
								totalAmount: KyselyNotNull;
								quantity: KyselyNotNull;
								item: KyselyNotNull;
							}>(),
					).as("items"),

					evoluJsonArrayFrom(
						eb
							.selectFrom("posBillRate")
							.select([
								"posBillRate.id as id",
								"posBillRate.billId as billId",
								"posBillRate.currency as currency",
								"posBillRate.rate as rate",
							] as const)
							.whereRef("posBillRate.billId", "=", "posBill.id")
							.where("posBillRate.isDeleted", "is not", sqliteTrue)
							.where("posBillRate.billId", "is not", null)
							.where("posBillRate.currency", "is not", null)
							.where("posBillRate.rate", "is not", null)
							.$narrowType<{
								billId: KyselyNotNull;
								currency: KyselyNotNull;
								rate: KyselyNotNull;
							}>(),
					).as("rates"),
				] as const,
		)
		.where("posBill.isDeleted", "is not", sqliteTrue)
		.where("posBill.displayId", "is not", null)
		.where("posBill.currency", "is not", null)
		.orderBy("posBill.createdAt", "asc")
		.$narrowType<{
			displayId: KyselyNotNull;
			currency: KyselyNotNull;
		}>(),
);

export const usePosRows = (): BillRows => {
	const { data: billRows } = useEvoluQuery(posBillQuery);

	return {
		billRows,
	};
};

export const usePos = (): Pos => {
	const { billRows } = usePosRows();

	return {
		bills: Object.fromEntries(billRows.map((bill) => [bill.id, bill])),
	};
};
