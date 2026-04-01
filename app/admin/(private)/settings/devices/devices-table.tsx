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
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useDataTableVisibilityDriver } from "@/hooks/use-data-table-visibility-driver";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import type { NonEmptyString255 } from "@/lib/shared/types";

type DeviceItem = {
	id: Id;
	createdAt: DateIso;
	name: NonEmptyString255;
	deviceType: string | null;
	deviceVendor: string | null;
	browserName: string | null;
	osName: string | null;
};

const createColumns = (t: TFunction): ColumnDef<DeviceItem, DeviceItem>[] => [
	{
		accessorKey: "name",
		header: createSortableHeader(t("devices:table.columns.name")),
		cell: ({ row }) => (
			<Link
				href={`/admin/settings/devices/detail?id=${encodeURIComponent(row.original.id)}`}
			>
				<Button variant={"link"}>{row.original.name}</Button>
			</Link>
		),
	},
	{
		accessorKey: "createdAt",
		header: createSortableHeader(t("devices:table.columns.created-at")),
		cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
	},
	{
		accessorKey: "deviceType",
		header: createSortableHeader(t("devices:table.columns.device-type")),
		cell: ({ row }) => row.original.deviceType ?? "-",
	},
	{
		accessorKey: "deviceVendor",
		header: createSortableHeader(t("devices:table.columns.device-vendor")),
		cell: ({ row }) => row.original.deviceVendor ?? "-",
	},
	{
		accessorKey: "browserName",
		header: createSortableHeader(t("devices:table.columns.browser-name")),
		cell: ({ row }) => row.original.browserName ?? "-",
	},
	{
		accessorKey: "osName",
		header: createSortableHeader(t("devices:table.columns.os-name")),
		cell: ({ row }) => row.original.osName ?? "-",
	},
];

const sortingFields = {
	id: "device.id",
	name: "device.name",
	createdAt: "device.createdAt",
	deviceType: "device.deviceType",
	deviceVendor: "device.deviceVendor",
	browserName: "device.browserName",
	osName: "device.osName",
} as const satisfies Record<keyof DeviceItem | "createdAt", string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "name",
			title: t("devices:table.columns.name"),
		},
	] satisfies { id: keyof DeviceItem; title: string }[];

export function DevicesTable() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("devices");
	const columns = useMemo(() => createColumns(t), [t]);
	const filterableColumns = useMemo(() => createFilterableColumns(t), [t]);

	const onFilterChange = useMemo<DataTableOnFilterChange<DeviceItem>>(
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
						.selectFrom("device")
						.select([
							"device.id as id",
							"device.name as name",
							"device.createdAt as createdAt",
							"device.deviceType as deviceType",
							"device.deviceVendor as deviceVendor",
							"device.browserName as browserName",
							"device.osName as osName",
						])
						.where("device.isDeleted", "is not", sqliteTrue)
						.where("device.name", "is not", null)
						.$narrowType<{
							name: KyselyNotNull;
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
									eb("device.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("device.id", "desc");

					for (const filter of filters) {
						if (filter.id === "name") {
							qb = qb.where(
								"device.name",
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
			<CardHeader>
				<CardTitle>{t("devices:table.devices")}</CardTitle>
				<CardDescription>
					{t("devices:table.listOfYourDevices")}
				</CardDescription>
			</CardHeader>
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
