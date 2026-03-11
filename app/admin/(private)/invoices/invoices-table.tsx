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
import type {
	Currency,
	DateString,
	Integer,
	NonEmptyString255,
} from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";

type Row = {
	id: Id;
	invoiceNumber: string;
	customerName: string | null;
	issueDate: DateString; // ISO date string
	dueDate: DateString; // ISO date string
	currency: Currency;
	totalAmount: Integer; // computed client-side
};

const createColumns = (t: TFunction): ColumnDef<Row>[] => [
	{
		accessorKey: "invoiceNumber",
		header: createSortableHeader(t("invoices:table.columns.invoice-number")),
	},
	{
		accessorKey: "customerName",
		header: createSortableHeader(t("invoices:table.columns.customer-name")),
	},
	{
		accessorKey: "issueDate",
		header: createSortableHeader(t("invoices:table.columns.issue-date")),
		cell: ({ row }) => new Date(row.original.issueDate).toLocaleDateString(),
	},
	{
		accessorKey: "dueDate",
		header: createSortableHeader(t("invoices:table.columns.due-date")),
		cell: ({ row }) => new Date(row.original.dueDate).toLocaleDateString(),
	},
	{
		accessorKey: "amount",
		header: createSortableHeader(t("invoices:table.columns.amount")),
		cell: ({ row }) =>
			formatMoney({
				value: row.original.totalAmount,
				currency: row.original.currency,
			}),
	},
	{
		accessorKey: "status",
		header: createSortableHeader(t("invoices:table.columns.status")),
		// cell: ({ row }) => (
		// 	<InvoiceStatusBadge
		// 		invoiceId={row.original.id}
		// 		dueDate={new Date(row.original.dueDate)}
		// 	/>
		// ),
	},
];

const sortingFields = {
	id: "invoice.id",
	createdAt: "invoice.createdAt",
	invoiceNumber: "invoice.invoiceNumber",
	customerName: "invoiceCustomer.name",
	issueDate: "invoice.issueDate",
	dueDate: "invoice.dueDate",
	currency: "invoice.currency",
	totalAmount: "totalAmount",
} as const satisfies Record<keyof Row | "createdAt", string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "invoiceNumber",
			title: t("invoices:table.columns.invoice-number"),
		},
		{
			id: "customerName",
			title: t("invoices:table.columns.customer-name"),
		},
	] satisfies { id: keyof Row; title: string }[];

export function InvoicesTable() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("invoices");
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
						.selectFrom("invoice")
						.leftJoin("invoiceCustomer", "invoiceCustomer.id", "invoice.id")
						.leftJoin(
							"invoiceItemLine",
							"invoiceItemLine.invoiceId",
							"invoice.id",
						)
						.select(
							(eb) =>
								[
									"invoice.id as id",
									"invoice.invoiceNumber as invoiceNumber",
									"invoice.issueDate as issueDate",
									"invoice.dueDate as dueDate",
									"invoice.currency as currency",
									"invoiceCustomer.name as customerName",
									"invoice.createdAt as createdAt",
									eb.fn
										.coalesce(
											eb.fn.sum<Integer>("invoiceItemLine.totalAmount"),
											eb.val(0),
										)
										.as("totalAmount"),
								] as const,
						)
						.where("invoice.isDeleted", "is not", sqliteTrue)
						.where("invoice.invoiceNumber", "is not", null)
						.where("invoice.currency", "is not", null)
						.where("invoice.dueDate", "is not", null)
						.where("invoice.issueDate", "is not", null)
						.groupBy("invoice.id")
						.$narrowType<{
							invoiceNumber: KyselyNotNull;
							currency: KyselyNotNull;
							dueDate: KyselyNotNull;
							issueDate: KyselyNotNull;
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
									eb("invoice.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("invoice.id", "desc");

					for (const filter of filters) {
						if (filter.id === "invoiceNumber") {
							qb = qb.where(
								"invoice.invoiceNumber",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}
						if (filter.id === "customerName") {
							qb = qb.where(
								"invoiceCustomer.name",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}
					}

					return qb.limit(limit + 1);
				});

				return subscribeToEvoluQuery(evolu, query, async (result) => {
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
				<CardTitle>{t("invoices:table.invoices")}</CardTitle>
				<CardDescription>
					{t("invoices:table.listOfYourInvoices")}
				</CardDescription>
				<CardAction>
					<Link href={"/admin/invoices/new"}>
						<Button>
							<PlusIcon />
							{t("invoices:table.actions.new-invoice")}
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
							`/admin/invoices/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
