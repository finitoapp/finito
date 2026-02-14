"use client";


import { useTranslation } from "react-i18next";
import { type Id, sqliteTrue } from "@evolu/common";
import type { TFunction } from "i18next";
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
import { formatIban } from "@/lib/format-utils";

type Task = {
	id: Id;
	name: string;
	_tag: string;
};

const createColumns = (t: TFunction): ColumnDef<Task, Task>[] => [
	{
		accessorKey: "name",
		header: createSortableHeader(t("accounts:table.columns.name")),
	},
	{
		accessorKey: "_tag",
		header: createSortableHeader(t("accounts:table.columns.type")),
	},
	{
		accessorKey: "address",
		header: createSortableHeader(t("accounts:table.columns.address")),
		cell: ({ row }) => {
			console.log("row", row.original);
			return row
				? row.original._tag === "accountLud16"
					? row.original["accountLud16.lud16"]
					: row.original._tag === "accountCashRegister"
						? "-"
						: row.original._tag === "accountSpark"
							? "-"
							: row.original._tag === "accountNwc"
								? "-"
								: formatIban(row.original["accountIban.iban"])
				: "-";
		},
	},
];

const createFilterableColumns = (t: TFunction) => [
	{
		id: "name",
		title: t("accounts:table.columns.name"),
	},
] satisfies { id: keyof Task; title: string }[];

export function AccountsTable() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("accounts");
	const columns = useMemo(() => createColumns(t), [t]);
	const filterableColumns = useMemo(() => createFilterableColumns(t), [t]);
	const onFilterChange = useMemo<DataTableOnFilterChange<Task>>(
		() =>
			({ filters, sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;

				const finalSorting = sorting ?? {
					id: "createdAt",
					desc: true,
				};
				const sortingColumn = `account.${finalSorting.id}`;

				const query = evolu.createQuery((db) => {
					let qb = db
						.selectFrom("account")
						.leftJoin("accountIban", "accountIban.id", "account.id")
						.leftJoin("accountLud16", "accountLud16.id", "account.id")
						.leftJoin("accountSpark", "accountSpark.id", "account.id")
						.leftJoin("accountNwc", "accountNwc.id", "account.id")
						.leftJoin(
							"accountCashRegister",
							"accountCashRegister.id",
							"account.id",
						)
						.select([
							"account.id as id",
							"account.name as name",
							"account._tag as _tag",
							"account.createdAt as createdAt",
							"accountIban.id as accountIban",
							"accountIban.iban as accountIban.iban",
							"accountIban.currency as accountIban.currency",
							"accountLud16.id as accountLud16",
							"accountLud16.lud16 as accountLud16.lud16",
							"accountSpark.id as accountSpark",
							"accountSpark.mnemonic as accountSpark.mnemonic",
							"accountNwc.id as accountNwc",
							"accountNwc.credentials as accountNwc.credentials",
							"accountCashRegister.id as accountCashRegister",
							"accountCashRegister.currency as accountCashRegister.currency",
						] as const)
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
									eb("account.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(sortingColumn, finalSorting.desc ? "desc" : "asc")
						.orderBy("account.id", "desc");

					for (const filter of filters) {
						if (filter.id === "name") {
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
					<CardTitle>{t("accounts:table.accounts")}</CardTitle>
					<CardDescription>
						{t("accounts:table.description.list-of-your-accounts")}
					</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/accounts/new"}>
						<Button>
							<PlusIcon />
							{t("accounts:table.actions.new-account")}
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
					searchPlaceholder={t("accounts:table.search.placeholder.by-name")}
					filterableColumns={filterableColumns}
					onRowClick={(item) =>
						router.push(
							`/admin/accounts/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
