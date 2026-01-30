"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import type { ColumnDef } from "@tanstack/react-table";
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
import { formatAmount } from "@/lib/format-utils";

type Task = {
	id: Id;
	label: string;
	categoryName: string | null;
	priceCurrency: string;
	priceValue: number;
};

const columns: ColumnDef<Task>[] = [
	{
		accessorKey: "label",
		header: createSortableHeader("Label"),
	},
	{
		accessorKey: "categoryName",
		header: createSortableHeader("Category"),
		cell: ({ row }) => row.original.categoryName ?? "-",
	},
	{
		accessorKey: "priceValue",
		header: createSortableHeader("Amount"),
		cell: ({ row }) =>
			formatAmount(row.original.priceValue, row.original.priceCurrency),
	},
];

export function ItemsTable() {
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("items");
	const onFilterChange = useMemo<DataTableOnFilterChange<Task>>(
		() =>
			({ filters, sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;

				const finalSorting = sorting ?? { id: "createdAt", desc: true };

				const query = evolu.createQuery((db) => {
					let qb = db
						.selectFrom("item")
						.leftJoin("category", "category.id", "item.categoryId")
						.select([
							"item.id as id",
							"item.label as label",
							"item.priceValue as priceValue",
							"item.priceCurrency as priceCurrency",
							"item.createdAt as createdAt",
							"category.name as categoryName",
						] as const)
						.where("item.isDeleted", "is not", sqliteTrue);

					if (previousCursor) {
						qb = qb.where((eb) =>
							eb.or([
								eb(
									`item.${finalSorting.id}`,
									finalSorting.desc ? "<" : ">",
									previousCursor[finalSorting.id],
								),
								eb.and([
									eb(
										`item.${finalSorting.id}`,
										"=",
										previousCursor[finalSorting.id],
									),
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
							qb = qb.where("item.label", "like", `${filter.value}%`);
						}
						if (filter.id === "categoryName") {
							qb = qb.where("category.name", "like", `${filter.value}%`);
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
					<CardTitle>Items</CardTitle>
					<CardDescription>List of your sales items</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/items/new"}>
						<Button>
							<PlusIcon />
							New item
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
					searchPlaceholder="Search by label..."
					filterableColumns={[
						{
							id: "label",
							title: "Label",
						},
						{
							id: "categoryName",
							title: "Category",
						},
					]}
					onRowClick={(item) =>
						router.push(`/admin/items/detail?id=${encodeURIComponent(item.id)}`)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
