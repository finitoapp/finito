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
import { formatMoney } from "@/lib/shared/utils/format";

type Task = {
	id: Id;
	deviceId: Id | null;
	deviceName: string | null;
	createdAt: DateIso;
	label: NonEmptyString255;
	categoryId: Id | null;
	categoryName: string | null;
	currency: Currency;
	price: Integer;
};

const createColumns = (t: TFunction): ColumnDef<Task>[] => [
	{
		accessorKey: "label",
		header: createSortableHeader(t("items:table.columns.label")),
		cell: ({ row }) => (
			<Link
				href={
					`/admin/catalog/detail?id=${encodeURIComponent(row.original.id)}` as never
				}
			>
				<Button variant={"link"}>{row.original.label}</Button>
			</Link>
		),
	},
	{
		accessorKey: "categoryName",
		header: createSortableHeader(t("items:table.columns.category")),
		cell: ({ row }) =>
			row.original.categoryName && row.original.categoryId ? (
				<Button
					variant="link"
					nativeButton={false}
					render={
						<Link
							href={
								`/admin/catalog/categories/detail?id=${encodeURIComponent(row.original.categoryId)}` as never
							}
						/>
					}
				>
					{row.original.categoryName}
				</Button>
			) : (
				"-"
			),
	},
	{
		accessorKey: "price",
		header: createSortableHeader(t("items:table.columns.amount")),
		cell: ({ row }) =>
			formatMoney({
				value: row.original.price,
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

const sortingFields = {
	id: "catalogItem.id",
	deviceId: "device.id",
	deviceName: "device.name",
	label: "catalogItem.label",
	price: "catalogItem.price",
	currency: "catalogItem.currency",
	createdAt: "catalogItem.createdAt",
	categoryId: "category.id",
	categoryName: "category.name",
} as const satisfies Record<keyof Task, string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "label",
			title: t("items:table.columns.label"),
		},
		{
			id: "categoryName",
			title: t("items:table.columns.category"),
		},
	] satisfies { id: keyof Task; title: string }[];

export function ItemsTable() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("items");
	const columns = useMemo(() => createColumns(t), [t]);
	const filterableColumns = useMemo(() => createFilterableColumns(t), [t]);
	const onFilterChange = useMemo<DataTableOnFilterChange<Task>>(
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
						.selectFrom("catalogItem")
						.leftJoin("device", "device.id", "catalogItem.deviceId")
						.leftJoin("category", "category.id", "catalogItem.categoryId")
						.select([
							"catalogItem.id as id",
							"device.id as deviceId",
							"device.name as deviceName",
							"catalogItem.label as label",
							"catalogItem.price as price",
							"catalogItem.currency as currency",
							"catalogItem.createdAt as createdAt",
							"category.id as categoryId",
							"category.name as categoryName",
						] as const)
						.where("catalogItem.isDeleted", "is not", sqliteTrue)
						.where("catalogItem.label", "is not", null)
						.$narrowType<{
							label: KyselyNotNull;
							price: KyselyNotNull;
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
									eb("catalogItem.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("catalogItem.id", "desc");

					for (const filter of filters) {
						if (filter.id === "label") {
							qb = qb.where(
								"catalogItem.label",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}
						if (filter.id === "categoryName") {
							qb = qb.where(
								"category.name",
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
