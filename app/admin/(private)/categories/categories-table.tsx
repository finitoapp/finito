"use client";

import { type Id, type KyselyNotNull, sqliteTrue } from "@evolu/common";
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

type Task = {
	id: Id;
	name: string;
};

const createColumns = (t: TFunction): ColumnDef<Task>[] => [
	{
		accessorKey: "name",
		header: createSortableHeader(t("categories:table.columns.name")),
	},
];

const sortingFields = {
	id: "category.id",
	createdAt: "category.createdAt",
	name: "category.name",
} as const satisfies Record<keyof Task | "createdAt", string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "name",
			title: t("categories:table.columns.name"),
		},
	] satisfies { id: keyof Task; title: string }[];

export function CategoriesTable() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("categories");
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
						.selectFrom("category")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("name", "is not", null)
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
									eb("category.id", "<", previousCursor.id as never),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("category.id", "desc");

					for (const filter of filters) {
						if (filter.id === "name") {
							qb = qb.where(
								"category.name",
								"like",
								`${filter.value}%` as never,
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
				<CardTitle>{t("categories:table.categories")}</CardTitle>
				<CardDescription>
					{t("categories:table.listOfProductCategories")}
				</CardDescription>
				<CardAction>
					<Link href={"/admin/categories/new" as never}>
						<Button>
							<PlusIcon />
							{t("categories:table.actions.new-category")}
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
							`/admin/categories/detail?id=${encodeURIComponent(item.id)}` as never,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
