"use client";

import {
	evoluJsonArrayFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useDataTableVisibilityDriver } from "@/hooks/use-data-table-visibility-driver";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import type { NonEmptyString255, PositiveInteger } from "@/lib/shared/types";

type Task = {
	id: Id;
	deviceId: Id | null;
	deviceName: NonEmptyString255 | null;
	label: NonEmptyString255;
	numberOfSeats: PositiveInteger;
	codes: {
		code: NonEmptyString255;
	}[];
};

const createColumns = (t: TFunction): ColumnDef<Task, Task>[] => [
	{
		accessorKey: "label",
		header: createSortableHeader(t("tables:table.columns.label")),
	},
	{
		accessorKey: "numberOfSeats",
		header: createSortableHeader(t("tables:table.columns.number-of-seats")),
	},
	{
		accessorKey: "codes",
		header: createSortableHeader(t("tables:table.columns.codes")),
		cell: ({ row }) => row.original.codes.map(({ code }) => code).join(","),
	},
	{
		accessorKey: "deviceName",
		header: createSortableHeader(t("tables:table.columns.device-name")),
		cell: ({ row }) =>
			row.original.deviceName && row.original.deviceId ? (
				<Button
					variant="link"
					onClick={(event) => {
						event.stopPropagation();
					}}
					render={
						<Link
							href={`/admin/tables/detail?id=${encodeURIComponent(row.original.deviceId)}`}
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
	id: "table.id",
	deviceId: "device.id",
	deviceName: "device.name",
	createdAt: "table.createdAt",
	label: "table.label",
	numberOfSeats: "table.numberOfSeats",
	codes: "table.id",
} as const satisfies Record<keyof Task | "createdAt", string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "label",
			title: t("tables:table.columns.label"),
		},
	] satisfies { id: keyof Task; title: string }[];

export function TablesTable() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("tables");
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
						.selectFrom("table")
						.leftJoin("device", "table.deviceId", "device.id")
						.select((eb) => [
							"table.id as id",
							"table.label as label",
							"table.numberOfSeats as numberOfSeats",
							"table.createdAt as createdAt",
							"device.id as deviceId",
							"device.name as deviceName",

							evoluJsonArrayFrom(
								eb
									.selectFrom("tableCode")
									.select([
										"tableCode.id as id",
										"tableCode.code as code",
									] as const)
									.whereRef("tableCode.tableId", "=", "table.id")
									.where("tableCode.isDeleted", "is not", sqliteTrue)
									.where("tableCode.code", "is not", null)
									.$narrowType<{
										code: KyselyNotNull;
									}>(),
							).as("codes"),
						])
						.where("table.isDeleted", "is not", sqliteTrue)
						.where("table.label", "is not", null)
						.where("table.numberOfSeats", "is not", null)
						.$narrowType<{
							codes: KyselyNotNull;
							label: KyselyNotNull;
							numberOfSeats: KyselyNotNull;
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
									eb("table.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("table.id", "desc");

					for (const filter of filters) {
						if (filter.id === "label") {
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
			<CardHeader>
				<CardTitle>{t("tables:table.tables")}</CardTitle>
				<CardDescription>{t("tables:table.listOfYourTables")}</CardDescription>
				<CardAction>
					<Link href={"/admin/tables/new"}>
						<Button>
							<PlusIcon />
							{t("tables:table.actions.new-table")}
						</Button>
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					filterableColumns={filterableColumns}
					onRowClick={(item) =>
						router.push(
							`/admin/tables/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
