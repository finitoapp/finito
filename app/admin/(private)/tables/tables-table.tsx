"use client";


import { useTranslation } from "react-i18next";
import { type Id, sqliteTrue } from "@evolu/common";
import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { jsonArrayFrom } from "kysely/helpers/sqlite";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
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
	CardHeading,
	CardTitle,
	CardToolbar,
} from "@/components/ui/card";
import { useDataTableVisibilityDriver } from "@/hooks/use-data-table-visibility-driver";
import { useEvolu } from "@/hooks/use-evolu";

type Task = {
	id: Id;
	label: string;
	numberOfSeats: string;
	codes: string;
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
		cell: ({ row }) =>
			JSON.parse(row.original.codes)
				.map(({ code }) => code)
				.join(","),
	},
];

const createFilterableColumns = (t: TFunction) => [
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

	const onFilterChange = useMemo<DataTableOnFilterChange<unknown>>(
		() =>
			({ filters, sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;

				const finalSorting = sorting ?? { id: "createdAt", desc: true };
				const sortingColumn = `table.${finalSorting.id}`;

				const query = evolu.createQuery((db) => {
					let qb = db
						.selectFrom("table")
						.select((eb) => [
							"table.id as id",
							"table.label as label",
							"table.numberOfSeats as numberOfSeats",
							"table.createdAt as createdAt",
							jsonArrayFrom(
								eb
									.selectFrom("tableCode")
									.select(["tableCode.code as code"])
									.where("tableCode.isDeleted", "is not", sqliteTrue)
									.whereRef("tableCode.tableId", "=", "table.id"),
							).as("codes"),
						])
						.where("table.isDeleted", "is not", sqliteTrue);

					if (previousCursor) {
						qb = qb.where((eb) =>
							eb.or([
								eb(
									sortingColumn,
									finalSorting.desc ? "<" : ">",
									previousCursor[finalSorting.id],
								),
								eb.and([
									eb(sortingColumn, "=", previousCursor[finalSorting.id]),
									eb("table.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(sortingColumn, finalSorting.desc ? "desc" : "asc")
						.orderBy("table.id", "desc");

					for (const filter of filters) {
						if (filter.id === "label") {
							qb = qb.where("table.label", "like", `${filter.value}%`);
						}
					}

					return qb.limit(limit + 1);
				});

				const formatData = (result) => {
					const data = result.length > limit ? result.slice(0, -1) : result;

					let nextCursor: undefined | Record<string, unknown>;
					const last = data[data.length - 1];
					if (result.length > limit && last) {
						nextCursor = {
							id: last.id,
							[finalSorting.id]: last[finalSorting.id],
						};
					}

					return {
						data,
						cursor:
							nextCursor !== undefined ? JSON.stringify(nextCursor) : undefined,
					};
				};

				void evolu.loadQuery(query).then((rows) => {
					setData(formatData(rows));
				});

				return evolu.subscribeQuery(query)(() => {
					setData(formatData(evolu.getQueryRows(query)));
				});
			},
		[evolu],
	);

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>{t("tables:table.tables")}</CardTitle>
					<CardDescription>{t("tables:table.listOfYourTables")}</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/tables/new"}>
						<Button>
							<PlusIcon />
							{t("tables:table.actions.new-table")}
						</Button>
					</Link>
				</CardToolbar>
			</CardHeader>
			<CardContent>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					searchKey="label"
					searchPlaceholder={t("tables:table.search.placeholder.by-label")}
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
