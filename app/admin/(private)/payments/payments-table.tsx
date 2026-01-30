"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { PaymentStatusBadge } from "@/app/admin/(private)/payments/payment-status-badge";
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
	createdAt: string;
	amount: number;
	billCurrency: string;
	label: string;
};

const columns: ColumnDef<Row>[] = [
	{
		accessorKey: "createdAt",
		header: createSortableHeader("Created at"),
		cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
	},
	{
		accessorKey: "amount",
		header: "Amount",
		cell: ({ row }) =>
			formatAmount(row.original.amount, row.original.billCurrency),
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => <PaymentStatusBadge paymentId={row.original.id} />,
	},
	{
		accessorKey: "label",
		header: "Description",
	},
];

export function PaymentsTable() {
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("payments");
	const onFilterChange = useMemo<DataTableOnFilterChange<Row>>(
		() =>
			({ sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;
				const finalSorting = sorting ?? {
					id: "createdAt",
					desc: true,
				};

				const query = evolu.createQuery((db) => {
					let qb = db
						.selectFrom("payment")
						.select([
							"payment.id as id",
							"payment.billCurrency as billCurrency",
							"payment.createdAt as createdAt",
						] as const)
						.where("payment.isDeleted", "is not", sqliteTrue);

					if (previousCursor) {
						qb = qb.where((eb) =>
							eb.or([
								eb(
									"createdAt",
									finalSorting.desc ? "<" : ">",
									previousCursor.createdAt as string,
								),
								eb.and([
									eb("createdAt", "=", previousCursor.createdAt as string),
									eb("id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					return qb
						.orderBy("createdAt", finalSorting.desc ? "desc" : "asc")
						.orderBy("id", "desc")
						.limit(limit + 1);
				});

				const formatData = async (result) => {
					const payments = result.length > limit ? result.slice(0, -1) : result;

					let nextCursor: undefined | Record<string, unknown>;
					const last = payments[payments.length - 1];
					if (result.length > limit && last) {
						nextCursor = {
							id: last.id,
							createdAt: last.createdAt,
						};
					}

					const ids = payments.map((payment) => payment.id);
					const billItems =
						ids.length > 0
							? await evolu.loadQuery(
									evolu.createQuery((db) =>
										db
											.selectFrom("paymentBillItem")
											.select([
												"paymentBillItem.paymentId as paymentId",
												"paymentBillItem.price as price",
												"paymentBillItem.label as label",
											] as const)
											.where("paymentBillItem.isDeleted", "is not", sqliteTrue)
											.where("paymentBillItem.paymentId", "in", ids as Id[]),
									),
								)
							: [];

					const rows: Row[] = payments.map((payment) => {
						const relatedItems = billItems.filter(
							(item) => item.paymentId === payment.id,
						);
						return {
							id: payment.id,
							createdAt: payment.createdAt,
							amount: relatedItems.reduce(
								(acc, val) => acc + (val.price ?? 0),
								0,
							),
							billCurrency: payment.billCurrency ?? "",
							label: relatedItems[0]?.label ?? "-",
						};
					});

					return {
						data: rows,
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
					<CardTitle>Payment Messages</CardTitle>
					<CardDescription>
						Decrypted payment data from Nostr NIP-04 direct messages
					</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/payments/new"}>
						<Button>
							<PlusIcon />
							New payment
						</Button>
					</Link>
				</CardToolbar>
			</CardHeader>
			<CardContent>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					onRowClick={(payment) =>
						router.push(
							`/admin/payments/detail?id=${encodeURIComponent(payment.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
