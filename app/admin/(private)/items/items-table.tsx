"use client";

import {
	type DateIso,
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
	CardContent,
	CardDescription,
	CardHeader,
	CardHeading,
	CardTitle,
	CardToolbar,
} from "@/components/ui/card";
import { useDataTableVisibilityDriver } from "@/hooks/use-data-table-visibility-driver";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import type { Currency, Integer, NonEmptyString255 } from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";

type Task = {
	id: Id;
	createdAt: DateIso;
	label: NonEmptyString255;
	categoryName: string | null;
	currency: Currency;
	price: Integer;
};

const createColumns = (t: TFunction): ColumnDef<Task>[] => [
	{
		accessorKey: "label",
		header: createSortableHeader(t("items:table.columns.label")),
	},
	{
		accessorKey: "categoryName",
		header: createSortableHeader(t("items:table.columns.category")),
		cell: ({ row }) => row.original.categoryName ?? "-",
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
];

const sortingFields = {
	id: "item.id",
	label: "item.label",
	price: "item.price",
	currency: "item.currency",
	createdAt: "item.createdAt",
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
	const router = useRouter();
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
						.selectFrom("item")
						.leftJoin("category", "category.id", "item.categoryId")
						.select([
							"item.id as id",
							"item.label as label",
							"item.price as price",
							"item.currency as currency",
							"item.createdAt as createdAt",
							"category.name as categoryName",
						] as const)
						.where("item.isDeleted", "is not", sqliteTrue)
						.where("item.label", "is not", null)
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
									eb("item.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("item.id", "desc");

					for (const filter of filters) {
						if (filter.id === "label") {
							qb = qb.where(
								"item.label",
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
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>{t("items:table.items")}</CardTitle>
					<CardDescription>
						{t("items:table.listOfYourSalesItems")}
					</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/items/new"}>
						<Button>
							<PlusIcon />
							{t("items:table.actions.new-item")}
						</Button>
					</Link>
				</CardToolbar>
			</CardHeader>
			<CardContent>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					filterableColumns={filterableColumns}
					onRowClick={(item) =>
						router.push(`/admin/items/detail?id=${encodeURIComponent(item.id)}`)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
