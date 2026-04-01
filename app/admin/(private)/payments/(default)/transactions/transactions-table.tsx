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
import type { NonEmptyString255, TimestampMs } from "@/lib/shared/types";

type Row = {
	id: Id;
	deviceId: Id | null;
	deviceName: string | null;
	occurredAt: TimestampMs;
	createdAt: DateIso;
	accountName: string;
	type: string;
	amount: number;
	note: string | null;
};

const createColumns = (t: TFunction): ColumnDef<Row>[] => [
	{
		accessorKey: "occurredAt",
		header: createSortableHeader(t("transactions:table.columns.occurred-at")),
		cell: ({ row }) => (
			<Link
				href={
					`/admin/payments/transactions/detail?id=${encodeURIComponent(row.original.id)}` as never
				}
			>
				<Button variant={"link"}>
					{new Date(row.original.occurredAt).toLocaleString()}
				</Button>
			</Link>
		),
	},
	{
		accessorKey: "createdAt",
		header: createSortableHeader(t("transactions:table.columns.created-at")),
		cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
	},
	{
		accessorKey: "accountName",
		header: createSortableHeader(t("transactions:table.columns.account")),
	},
	{
		accessorKey: "type",
		header: createSortableHeader(t("transactions:table.columns.type")),
	},
	{
		accessorKey: "amount",
		header: createSortableHeader(t("transactions:table.columns.amount")),
		cell: ({ row }) => {
			const amount = row.original.amount;
			return amount > 0 ? `+${amount}` : `${amount}`;
		},
	},
	{
		accessorKey: "note",
		header: t("transactions:table.columns.note"),
		cell: ({ row }) => row.original.note ?? "-",
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
			id: "accountName",
			title: t("transactions:table.columns.account"),
		},
	] satisfies { id: keyof Row; title: string }[];

const sortingFields = {
	id: "transaction.id",
	deviceId: "device.id",
	deviceName: "device.name",
	occurredAt: "transaction.occurredAt",
	createdAt: "transaction.createdAt",
	amount: "transaction.amount",
	accountName: "account.name",
	type: "transaction._tag",
	note: "transaction.note",
} as const;

export function TransactionsTable() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("transactions");
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
						.selectFrom("transaction")
						.leftJoin("device", "device.id", "transaction.deviceId")
						.innerJoin("account", "account.id", "transaction.accountId")
						.select([
							"transaction.id as id",
							"device.id as deviceId",
							"device.name as deviceName",
							"transaction.occurredAt as occurredAt",
							"transaction.createdAt as createdAt",
							"account.name as accountName",
							"transaction._tag as type",
							"transaction.amount as amount",
							"transaction.note as note",
						] as const)
						.where("transaction.isDeleted", "is not", sqliteTrue)
						.where("account.isDeleted", "is not", sqliteTrue)
						.where("transaction.occurredAt", "is not", null)
						.where("transaction._tag", "is not", null)
						.where("transaction.amount", "is not", null)
						.where("account.name", "is not", null)
						.$narrowType<{
							occurredAt: KyselyNotNull;
							accountName: KyselyNotNull;
							type: KyselyNotNull;
							amount: KyselyNotNull;
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
									eb("transaction.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("transaction.id", "desc");

					for (const filter of filters) {
						if (filter.id === "accountName") {
							qb = qb.where(
								"account.name",
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
