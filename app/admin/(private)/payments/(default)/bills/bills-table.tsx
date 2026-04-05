"use client";

import {
	type DateIso,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { sql } from "kysely";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	createSortableHeader,
	DataTable,
	type DataTableOnFilterChange,
} from "@/components/data-table";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { useDataTableVisibilityDriver } from "@/hooks/use-data-table-visibility-driver";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import type { Currency, Integer, NonEmptyString255 } from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";

type Row = {
	id: Id;
	deviceId: Id | null;
	deviceName: string | null;
	createdAt: DateIso;
	displayId: number;
	label: string | null;
	tableId: Id | null;
	tableLabel: string | null;
	totalAmount: Integer;
	currency: Currency;
};

const createColumns = (t: TFunction): ColumnDef<Row>[] => [
	{
		accessorKey: "displayId",
		header: createSortableHeader(t("bills:table.columns.bill")),
		cell: ({ row }) => (
			<Link
				href={
					`/admin/payments/bills/detail?id=${encodeURIComponent(row.original.id)}` as never
				}
			>
				<Button variant={"link"}>#{row.original.displayId}</Button>
			</Link>
		),
	},
	{
		accessorKey: "createdAt",
		header: createSortableHeader(t("bills:table.columns.createdAt")),
		cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
	},
	{
		accessorKey: "label",
		header: createSortableHeader(t("bills:table.columns.label")),
		cell: ({ row }) => row.original.label ?? "-",
	},
	{
		accessorKey: "tableLabel",
		header: createSortableHeader(t("bills:table.columns.table")),
		cell: ({ row }) =>
			row.original.tableLabel && row.original.tableId ? (
				<Button
					variant="link"
					nativeButton={false}
					onClick={(event) => {
						event.stopPropagation();
					}}
					render={
						<Link
							href={
								`/admin/venue/tables/detail?id=${encodeURIComponent(row.original.tableId)}` as never
							}
						/>
					}
				>
					{row.original.tableLabel}
				</Button>
			) : (
				"-"
			),
	},
	{
		accessorKey: "totalAmount",
		header: createSortableHeader(t("bills:table.columns.amount")),
		cell: ({ row }) =>
			formatMoney({
				value: row.original.totalAmount,
				currency: row.original.currency,
			}),
	},
	{
		accessorKey: "deviceName",
		header: createSortableHeader(t("tables:table.columns.device-name")),
		cell: ({ row }) =>
			row.original.deviceName && row.original.deviceId ? (
				<Button
					variant="link"
					nativeButton={false}
					onClick={(event) => {
						event.stopPropagation();
					}}
					render={
						<Link
							href={
								`/admin/settings/devices/detail?id=${encodeURIComponent(row.original.deviceId)}` as never
							}
						/>
					}
				>
					{row.original.deviceName}
				</Button>
			) : (
				"-"
			),
	},
];

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "label",
			title: t("bills:table.columns.label"),
		},
		{
			id: "tableLabel",
			title: t("bills:table.columns.table"),
		},
	] satisfies { id: keyof Row; title: string }[];

const sortingFields = {
	id: "posBill.id",
	deviceId: "device.id",
	deviceName: "device.name",
	createdAt: "posBill.createdAt",
	displayId: "posBill.displayId",
	label: "posBill.label",
	tableId: "table.id",
	tableLabel: "table.label",
	totalAmount: "totalAmount",
	currency: "posBill.currency",
} as const satisfies Record<keyof Row, string>;

export function BillsTable() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("bills");
	const columns = useMemo(() => createColumns(t), [t]);
	const filterableColumns = useMemo(() => createFilterableColumns(t), [t]);
	const onFilterChange = useMemo<DataTableOnFilterChange<Row>>(
		() =>
			({ filters, sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;

				const sortingField = sorting ? sorting.id : ("createdAt" as const);
				const fullSortingField = sortingFields[sortingField];

				const finalSorting = {
					id: fullSortingField,
					desc: sorting ? sorting.desc : true,
				};

				const query = createQuery((db) => {
					let qb = db
						.selectFrom("posBill")
						.leftJoin("device", "device.id", "posBill.deviceId")
						.leftJoin("table", "table.id", "posBill.tableId")
						.leftJoin(
							"posBillItemLine",
							"posBillItemLine.posBillId",
							"posBill.id",
						)
						.select(
							(eb) =>
								[
									"posBill.id as id",
									"device.id as deviceId",
									"device.name as deviceName",
									"posBill.createdAt as createdAt",
									"posBill.displayId as displayId",
									"posBill.label as label",
									"table.id as tableId",
									"table.label as tableLabel",
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
								] as const,
						)
						.where("posBill.isDeleted", "is not", sqliteTrue)
						.where("posBill.displayId", "is not", null)
						.where("posBill.currency", "is not", null)
						.groupBy("posBill.id")
						.$narrowType<{
							displayId: KyselyNotNull;
							currency: KyselyNotNull;
							totalAmount: KyselyNotNull;
						}>();

					if (previousCursor) {
						qb = qb.where((eb) =>
							eb.or([
								eb(
									finalSorting.id,
									finalSorting.desc ? "<" : ">",
									previousCursor[finalSorting.id],
								),
								eb.and([
									eb(finalSorting.id, "=", previousCursor[finalSorting.id]),
									eb("posBill.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc");
					qb = qb.orderBy("posBill.id", "desc");

					for (const filter of filters) {
						if (filter.id === "label") {
							qb = qb.where(
								"posBill.label",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}

						if (filter.id === "tableLabel") {
							qb = qb.where(
								"table.label",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}
					}

					return qb.limit(limit + 1);
				});

				return subscribeToEvoluQuery(evolu, query, (result) => {
					const data = result.length > limit ? result.slice(0, -1) : result;

					let nextCursor: undefined | Record<string, unknown>;
					const last = data[data.length - 1];
					if (result.length > limit && last) {
						nextCursor = {
							id: last.id,
							[sortingField]: last[sortingField],
						};
					}

					setData({
						data: [...data],
						cursor:
							nextCursor !== undefined ? JSON.stringify(nextCursor) : undefined,
					});
				});
			},
		[evolu],
	);

	return (
		<ResponsiveCard>
			<CardContent className={"px-0"}>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					filterableColumns={filterableColumns}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
