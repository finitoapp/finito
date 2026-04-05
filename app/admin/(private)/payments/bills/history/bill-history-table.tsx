"use client";

import {
	type DateIso,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
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
import { formatDateTime, formatMoney } from "@/lib/shared/utils/format";

type Row = {
	id: Id;
	deviceId: Id | null;
	deviceName: string | null;
	itemId: Id | null;
	itemLabel: string | null;
	createdAt: DateIso;
	type: "add" | "remove";
	quantity: number;
	totalAmount: Integer;
	currency: Currency;
};

const createTypeLabel = (t: TFunction, type: Row["type"]) =>
	t(`bills:detail.history.type.${type}`);

const createColumns = (t: TFunction): ColumnDef<Row>[] => [
	{
		accessorKey: "createdAt",
		header: createSortableHeader(t("bills:detail.history.columns.createdAt")),
		cell: ({ row }) => formatDateTime(new Date(row.original.createdAt)),
	},
	{
		accessorKey: "itemLabel",
		header: createSortableHeader(t("bills:detail.history.columns.item")),
		cell: ({ row }) =>
			row.original.itemLabel && row.original.itemId ? (
				<Button
					variant="link"
					nativeButton={false}
					onClick={(event) => {
						event.stopPropagation();
					}}
					render={
						<Link
							href={
								`/admin/catalog/detail?id=${encodeURIComponent(row.original.itemId)}` as never
							}
						/>
					}
				>
					{row.original.itemLabel}
				</Button>
			) : (
				(row.original.itemLabel ?? "-")
			),
	},
	{
		accessorKey: "type",
		header: createSortableHeader(t("bills:detail.history.columns.type")),
		cell: ({ row }) => createTypeLabel(t, row.original.type),
	},
	{
		accessorKey: "quantity",
		header: createSortableHeader(t("bills:detail.history.columns.quantity")),
		cell: ({ row }) => row.original.quantity.toLocaleString(),
	},
	{
		accessorKey: "totalAmount",
		header: createSortableHeader(t("bills:detail.history.columns.amount")),
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
			id: "itemLabel",
			title: t("bills:detail.history.columns.item"),
		},
		{
			id: "type",
			title: t("bills:detail.history.columns.type"),
			options: [
				{
					label: createTypeLabel(t, "add"),
					value: "add",
				},
				{
					label: createTypeLabel(t, "remove"),
					value: "remove",
				},
			],
		},
	] satisfies {
		id: keyof Row;
		title: string;
		options?: { label: string; value: string }[];
	}[];

const sortingFields = {
	id: "posBillItemLine.id",
	deviceId: "device.id",
	deviceName: "device.name",
	itemId: "item.id",
	itemLabel: "itemRevision.label",
	createdAt: "posBillItemLine.createdAt",
	type: "posBillItemLine._tag",
	quantity: "posBillItemLine.quantity",
	totalAmount: "posBillItemLine.totalAmount",
	currency: "posBill.currency",
} as const satisfies Record<keyof Row, string>;

export function BillHistoryTable(props: Readonly<{ billId: Id }>) {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("bill-history");
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
						.selectFrom("posBillItemLine")
						.leftJoin("device", "device.id", "posBillItemLine.deviceId")
						.leftJoin(
							"itemRevision",
							"itemRevision.id",
							"posBillItemLine.itemRevisionId",
						)
						.leftJoin("item", "item.id", "itemRevision.itemId")
						.innerJoin("posBill", "posBill.id", "posBillItemLine.posBillId")
						.select([
							"posBillItemLine.id as id",
							"device.id as deviceId",
							"device.name as deviceName",
							"item.id as itemId",
							"itemRevision.label as itemLabel",
							"posBillItemLine.createdAt as createdAt",
							"posBillItemLine._tag as type",
							"posBillItemLine.quantity as quantity",
							"posBillItemLine.totalAmount as totalAmount",
							"posBill.currency as currency",
						] as const)
						.where("posBillItemLine.isDeleted", "is not", sqliteTrue)
						.where("posBill.isDeleted", "is not", sqliteTrue)
						.where("posBill.id", "=", props.billId)
						.where("posBillItemLine._tag", "is not", null)
						.where("posBillItemLine.quantity", "is not", null)
						.where("posBillItemLine.totalAmount", "is not", null)
						.where("posBill.currency", "is not", null)
						.$narrowType<{
							type: KyselyNotNull;
							quantity: KyselyNotNull;
							totalAmount: KyselyNotNull;
							currency: KyselyNotNull;
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
									eb("posBillItemLine.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("posBillItemLine.id", "desc");

					for (const filter of filters) {
						if (filter.id === "itemLabel") {
							qb = qb.where(
								"itemRevision.label",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}

						if (filter.id === "type" && filter.value) {
							qb = qb.where(
								"posBillItemLine._tag",
								"=",
								filter.value as Row["type"],
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
		[evolu, props.billId],
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
