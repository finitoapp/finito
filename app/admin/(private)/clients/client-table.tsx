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
import { CountryCode } from "@/lib/types";

type Task = {
	id: Id;
	name: string;
	_tag: string;
};

const columns: ColumnDef<Task, Task>[] = [
	{
		accessorKey: "name",
		header: createSortableHeader("Name"),
	},
	{
		accessorKey: "vatNumber",
		header: createSortableHeader("VAT Number"),
		cell: ({ row }) => {
			console.log("row", row.original);
			return row.original.countryCode === CountryCode.CZ
				? row.original["clientCz.vatNumber"]
				: "-";
		},
	},
];

export function ClientTable() {
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("clients");
	const onFilterChange = useMemo<DataTableOnFilterChange<Task>>(
		() =>
			({ filters, sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;

				const finalSorting = sorting ?? {
					id: "createdAt",
					desc: true,
				};
				const sortingColumn = `client.${finalSorting.id}`;

				const query = evolu.createQuery((db) => {
					let qb = db
						.selectFrom("client")
						.leftJoin("clientAddress", "clientAddress.id", "client.id")
						.leftJoin("clientCz", "clientCz.id", "client.id")
						.select([
							"client.id as id",
							"client.name as name",
							"client.label as label",
							"client.countryCode as countryCode",
							"client.createdAt as createdAt",
							"clientCz.vatNumber as clientCz.vatNumber",
						] as const)
						.where("client.isDeleted", "is not", sqliteTrue);

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
									eb("client.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(sortingColumn, finalSorting.desc ? "desc" : "asc")
						.orderBy("client.id", "desc");

					for (const filter of filters) {
						if (filter.id === "name") {
							qb = qb.where("client.name", "like", `${filter.value}%`);
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
					<CardTitle>Clients</CardTitle>
					<CardDescription>List of your clients</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/clients/new"}>
						<Button>
							<PlusIcon />
							New client
						</Button>
					</Link>
				</CardToolbar>
			</CardHeader>
			<CardContent>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					searchKey="name"
					searchPlaceholder="Search by name..."
					filterableColumns={[
						{
							id: "name",
							title: "Name",
						},
					]}
					onRowClick={(item) =>
						router.push(
							`/admin/clients/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
