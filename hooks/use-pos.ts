import { type Id, sqliteTrue } from "@evolu/common";
import { useMemo } from "react";
import { z } from "zod";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { Currency, type NonEmptyString } from "@/lib/types";

export type PosItem = {
	id: string;
	name: string;
	price: number;
	quantity: number;
	currency: Currency;
};

export type PosBill = {
	id: number;
	label: string;
	items: PosItem[];
	currency: Currency;
	rates: Partial<Record<Currency, number>>;
	table?: {
		id: Id;
		name: NonEmptyString;
	};
};

export type Pos = {
	bills: Record<string, PosBill>;
};

type PosBillRow = {
	id: Id;
	displayId: number;
	label: string | null;
	currency: string;
	tableId: Id | null;
};

type PosBillItemRow = {
	id: Id;
	billId: Id;
	sourceItemId: string;
	name: string;
	price: number;
	quantity: number;
	currency: string;
};

type PosBillRateRow = {
	id: Id;
	billId: Id;
	currency: string;
	rate: number;
};

type TableRow = {
	id: Id;
	label: string;
};

const parseCurrency = (value: string): Currency | null => {
	const result = z.enum(Currency).safeParse(value);
	return result.success ? result.data : null;
};

export const usePosRows = () => {
	const billsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("posBill")
				.select([
					"posBill.id as id",
					"posBill.displayId as displayId",
					"posBill.label as label",
					"posBill.currency as currency",
					"posBill.tableId as tableId",
				] as const)
				.where("posBill.isDeleted", "is not", sqliteTrue)
				.orderBy("posBill.createdAt", "asc"),
		[],
	);
	const billRows = (useEvoluQuery(billsQuery).data ?? []) as PosBillRow[];

	const billItemsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("posBillItem")
				.select([
					"posBillItem.id as id",
					"posBillItem.billId as billId",
					"posBillItem.sourceItemId as sourceItemId",
					"posBillItem.name as name",
					"posBillItem.price as price",
					"posBillItem.quantity as quantity",
					"posBillItem.currency as currency",
				] as const)
				.where("posBillItem.isDeleted", "is not", sqliteTrue)
				.orderBy("posBillItem.createdAt", "asc"),
		[],
	);
	const billItemRows = (useEvoluQuery(billItemsQuery).data ??
		[]) as PosBillItemRow[];

	const billRatesQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("posBillRate")
				.select([
					"posBillRate.id as id",
					"posBillRate.billId as billId",
					"posBillRate.currency as currency",
					"posBillRate.rate as rate",
				] as const)
				.where("posBillRate.isDeleted", "is not", sqliteTrue),
		[],
	);
	const billRateRows = (useEvoluQuery(billRatesQuery).data ??
		[]) as PosBillRateRow[];

	const tablesQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("table")
				.select(["table.id as id", "table.label as label"] as const)
				.where("table.isDeleted", "is not", sqliteTrue),
		[],
	);
	const tableRows = (useEvoluQuery(tablesQuery).data ?? []) as TableRow[];

	return {
		billRows,
		billItemRows,
		billRateRows,
		tableRows,
	};
};

export const usePos = (): Pos => {
	const { billRows, billItemRows, billRateRows, tableRows } = usePosRows();

	return useMemo(() => {
		const tableById = new Map(
			tableRows.map((table) => [table.id, table] as const),
		);
		const bills: Pos["bills"] = {};

		for (const billRow of billRows) {
			const currency = parseCurrency(billRow.currency);
			if (currency === null) {
				continue;
			}

			const table = billRow.tableId
				? tableById.get(billRow.tableId)
				: undefined;

			bills[billRow.id] = {
				id: billRow.displayId,
				label: billRow.label ?? "",
				items: [],
				currency,
				rates: {},
				table: table
					? {
							id: table.id,
							name: table.label as NonEmptyString,
						}
					: undefined,
			};
		}

		for (const itemRow of billItemRows) {
			const bill = bills[itemRow.billId];
			if (bill === undefined) {
				continue;
			}

			const currency = parseCurrency(itemRow.currency);
			if (currency === null) {
				continue;
			}

			bill.items.push({
				id: itemRow.sourceItemId,
				name: itemRow.name,
				price: itemRow.price,
				quantity: itemRow.quantity,
				currency,
			});
		}

		for (const rateRow of billRateRows) {
			const bill = bills[rateRow.billId];
			if (bill === undefined) {
				continue;
			}

			const currency = parseCurrency(rateRow.currency);
			if (currency === null) {
				continue;
			}

			bill.rates[currency] = rateRow.rate;
		}

		return {
			bills,
		};
	}, [billRows, billItemRows, billRateRows, tableRows]);
};
