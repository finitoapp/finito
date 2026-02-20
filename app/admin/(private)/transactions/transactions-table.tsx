"use client";

import { type Id, sqliteTrue } from "@evolu/common";
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

type Row = {
	id: Id;
	occurredAt: number;
	createdAt: string;
	accountName: string;
	type: string;
	amount: number;
	note: string | null;
};

const createColumns = (t: TFunction): ColumnDef<Row>[] => [
	{
		accessorKey: "occurredAt",
		header: createSortableHeader(t("transactions:table.columns.occurred-at")),
		cell: ({ row }) => new Date(row.original.occurredAt).toLocaleString(),
	},
	{
		accessorKey: "createdAt",
		header: createSortableHeader(t("transactions:table.columns.created-at")),
		cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
	},
	{
		accessorKey: "accountName",
		header: createSortableHeader(t("transactions:table.columns.account")),
	},
	{
		accessorKey: "type",
		header: createSortableHeader(t("transactions:table.columns.type")),
	},
	{
		accessorKey: "amount",
		header: createSortableHeader(t("transactions:table.columns.amount")),
		cell: ({ row }) => {
			const amount = row.original.amount;
			return amount > 0 ? `+${amount}` : `${amount}`;
		},
	},
	{
		accessorKey: "note",
		header: t("transactions:table.columns.note"),
		cell: ({ row }) => row.original.note ?? "-",
	},
];

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "accountName",
			title: t("transactions:table.columns.account"),
		},
	] satisfies { id: keyof Row; title: string }[];

const sortingColumnMap = {
	occurredAt: "transaction.occurredAt",
	createdAt: "transaction.createdAt",
	amount: "transaction.amount",
	accountName: "account.name",
	type: "transaction._tag",
} as const;

export function TransactionsTable() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("transactions");
	const columns = useMemo(() => createColumns(t), [t]);
	const filterableColumns = useMemo(() => createFilterableColumns(t), [t]);
	const onFilterChange = useMemo<DataTableOnFilterChange<Row>>(
		() =>
			({ filters, sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;

				const finalSorting = {
					id:
						sorting && sorting.id in sortingColumnMap
							? (sorting.id as keyof typeof sortingColumnMap)
							: ("occurredAt" as const),
					desc: sorting?.desc ?? true,
				};

				const sortingColumn = sortingColumnMap[finalSorting.id];

				const query = evolu.createQuery((db) => {
					let qb = db
						.selectFrom("transaction")
						.innerJoin("account", "account.id", "transaction.accountId")
						.select([
							"transaction.id as id",
							"transaction.occurredAt as occurredAt",
							"transaction.createdAt as createdAt",
							"account.name as accountName",
							"transaction._tag as type",
							"transaction.amount as amount",
							"transaction.note as note",
						] as const)
						.where("transaction.isDeleted", "is not", sqliteTrue)
						.where("account.isDeleted", "is not", sqliteTrue);

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
									eb("transaction.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(sortingColumn, finalSorting.desc ? "desc" : "asc")
						.orderBy("transaction.id", "desc");

					for (const filter of filters) {
						if (filter.id === "accountName") {
							qb = qb.where("account.name", "like", `${filter.value}%`);
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
					<CardTitle>{t("transactions:table.transactions")}</CardTitle>
					<CardDescription>
						{t("transactions:table.description.list-of-transactions")}
					</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/transactions/new"}>
						<Button>
							<PlusIcon />
							{t("transactions:table.actions.new-transaction")}
						</Button>
					</Link>
				</CardToolbar>
			</CardHeader>
			<CardContent>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					searchKey="accountName"
					searchPlaceholder={t(
						"transactions:table.search.placeholder.by-account",
					)}
					filterableColumns={filterableColumns}
					onRowClick={(item) =>
						router.push(
							`/admin/transactions/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
