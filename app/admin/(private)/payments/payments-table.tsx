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

type Row = {
	id: Id;
	createdAt: DateIso;
	totalAmount: Integer;
	currency: Currency;
	label: NonEmptyString255 | null;
	// status: PaymentStatus;
};

const sortingFields = {
	id: "payment.id",
	createdAt: "payment.createdAt",
	totalAmount: "payment.totalAmount",
	currency: "payment.currency",
	label: "paymentItem.label",
} as const satisfies Record<keyof Row | "createdAt", string>;

const createColumns = (t: TFunction): ColumnDef<Row>[] => [
	{
		accessorKey: "createdAt",
		header: createSortableHeader(t("payments:table.columns.created-at")),
		cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
	},
	{
		accessorKey: "amount",
		header: t("payments:table.columns.amount"),
		cell: ({ row }) =>
			formatMoney({
				value: row.original.totalAmount,
				currency: row.original.currency,
			}),
	},
	// {
	// 	accessorKey: "status",
	// 	header: t("payments:table.columns.status"),
	// 	cell: ({ row }) => (
	// 		<Badge
	// 			variant={
	// 				row.original.status === PaymentStatus.Unpaid ? "primary" : "success"
	// 			}
	// 		>
	// 			{row.original.status}
	// 		</Badge>
	// 	),
	// },
	{
		accessorKey: "label",
		header: t("payments:table.columns.description"),
	},
];

export function PaymentsTable() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("payments");
	const columns = useMemo(() => createColumns(t), [t]);
	const onFilterChange = useMemo<DataTableOnFilterChange<Row>>(
		() =>
			({ sorting, setData, pagination: { limit, cursor } }) => {
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
						.selectFrom("payment")
						.leftJoin(
							"paymentItemLine",
							"paymentItemLine.paymentId",
							"payment.id",
						)
						.leftJoin("paymentItem", "paymentItem.id", "paymentItemLine.id")
						.select([
							"payment.id as id",
							"payment.totalAmount as totalAmount",
							"payment.currency as currency",
							"payment.createdAt as createdAt",
							"paymentItem.label as label",
						] as const)
						.where("payment.isDeleted", "is not", sqliteTrue)
						.where("payment.totalAmount", "is not", null)
						.where("payment.currency", "is not", null)
						.groupBy("payment.id")
						.$narrowType<{
							totalAmount: KyselyNotNull;
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
									eb("payment.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("payment.id", "desc");

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
					<CardTitle>{t("payments:table.paymentMessages")}</CardTitle>
					<CardDescription>
						{t("payments:table.description.decrypted-payment-data")}
					</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/payments/new"}>
						<Button>
							<PlusIcon />
							{t("payments:table.actions.new-payment")}
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
