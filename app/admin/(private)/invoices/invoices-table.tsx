"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { InvoiceStatusBadge } from "@/app/admin/(private)/invoices/invoice-status-badge";
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

type Row = {
	id: Id;
	invoiceNumber: string;
	customerName: string;
	issueDate: string; // ISO date string
	dueDate: string; // ISO date string
	currency: string;
	amount: number; // computed client-side
};

const columns: ColumnDef<Row>[] = [
	{
		accessorKey: "invoiceNumber",
		header: createSortableHeader("Invoice number"),
	},
	{
		accessorKey: "customerName",
		header: createSortableHeader("Customer name"),
	},
	{
		accessorKey: "issueDate",
		header: createSortableHeader("Issue date"),
		cell: ({ row }) => new Date(row.original.issueDate).toLocaleDateString(),
	},
	{
		accessorKey: "dueDate",
		header: createSortableHeader("Due date"),
		cell: ({ row }) => new Date(row.original.dueDate).toLocaleDateString(),
	},
	{
		accessorKey: "amount",
		header: createSortableHeader("Amount"),
		cell: ({ row }) => formatAmount(row.original.amount, row.original.currency),
	},
	{
		accessorKey: "status",
		header: createSortableHeader("Status"),
		cell: ({ row }) => (
			<InvoiceStatusBadge
				invoiceId={row.original.id}
				dueDate={new Date(row.original.dueDate)}
			/>
		),
	},
];

export function InvoicesTable() {
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("invoices");
	const onFilterChange = useMemo<DataTableOnFilterChange<Row>>(
		() =>
			({ filters, sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;

				const finalSorting = sorting ?? {
					id: "createdAt",
					desc: true,
				};
				const sortingColumn = `invoice.${finalSorting.id}`;

				const query = evolu.createQuery((db) => {
					let qb = db
						.selectFrom("invoice")
						.leftJoin(
							"invoiceCustomerBillingInfo",
							"invoiceCustomerBillingInfo.id",
							"invoice.id",
						)
						.select([
							"invoice.id as id",
							"invoice.invoiceNumber as invoiceNumber",
							"invoice.issueDate as issueDate",
							"invoice.dueDate as dueDate",
							"invoice.currency as currency",
							"invoiceCustomerBillingInfo.name as customerName",
							"invoice.createdAt as invoice.createdAt",
						] as const)
						.where("invoice.isDeleted", "is not", sqliteTrue);

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
									eb("invoice.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(sortingColumn, finalSorting.desc ? "desc" : "asc")
						.orderBy("invoice.id", "desc");

					for (const filter of filters) {
						if (filter.id === "invoiceNumber") {
							qb = qb.where(
								"invoice.invoiceNumber",
								"like",
								`${filter.value}%`,
							);
						}
						if (filter.id === "customerName") {
							qb = qb.where(
								"invoiceCustomerBillingInfo.name",
								"like",
								`${filter.value}%`,
							);
						}
					}

					return qb.limit(limit + 1);
				});

				const formatData = async (result) => {
					const data = result.length > limit ? result.slice(0, -1) : result;

					let nextCursor: undefined | Record<string, unknown>;
					const last = data[data.length - 1];
					if (result.length > limit && last) {
						nextCursor = {
							id: last.id,
							[finalSorting.id]: last[finalSorting.id as keyof typeof last],
						};
					}

					const ids = data.map((d) => d.id);
					let amounts = new Map<Id, number>();
					if (ids.length > 0) {
						const items = await evolu.loadQuery(
							evolu.createQuery((db) =>
								db
									.selectFrom("invoiceItem")
									.select([
										"invoiceItem.invoiceId as invoiceId",
										"invoiceItem.price as price",
										"invoiceItem.quantity as quantity",
									] as const)
									.where("invoiceItem.isDeleted", "is not", sqliteTrue)
									.where("invoiceItem.invoiceId", "in", ids as Id[]),
							),
						);
						amounts = items.reduce((map, it) => {
							const prev = map.get(it.invoiceId as Id) ?? 0;
							map.set(it.invoiceId as Id, prev + it.price * it.quantity);
							return map;
						}, new Map<Id, number>());
					}

					return {
						data: data.map((d) => ({
							...d,
							amount: amounts.get(d.id as Id) ?? 0,
						})),
						cursor:
							nextCursor !== undefined ? JSON.stringify(nextCursor) : undefined,
					};
				};

				void evolu.loadQuery(query).then((rows) => {
					void formatData(rows).then(setData);
				});

				return evolu.subscribeQuery(query)(() => {
					void formatData(evolu.getQueryRows(query)).then(setData);
				});
			},
		[evolu],
	);

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>Invoices</CardTitle>
					<CardDescription>List of your invoices</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/invoices/new"}>
						<Button>
							<PlusIcon />
							New invoice
						</Button>
					</Link>
				</CardToolbar>
			</CardHeader>
			<CardContent>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					filterableColumns={[
						{ id: "invoiceNumber", title: "Invoice number" },
						{ id: "customerName", title: "Customer name" },
					]}
					onRowClick={(item) =>
						router.push(
							`/admin/invoices/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
