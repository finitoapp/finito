"use client";

import {
	evoluJsonObjectFrom,
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
import type { Currency, Iban, NonEmptyString255 } from "@/lib/shared/types";
import { formatIban } from "@/lib/shared/utils/format";

type Task = {
	id: Id;
	deviceId: Id | null;
	deviceName: string | null;
	name: string;
	_tag: string;
	accountLud16: {
		lud16: string;
	} | null;
	accountCashRegister: {
		currency: Currency;
	} | null;
	accountSpark: { id: Id } | null;
	accountNwc: { id: Id } | null;
	accountIban: {
		iban: Iban;
		currency: Currency;
	} | null;
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
			return row
				? row.original.accountLud16
					? row.original.accountLud16.lud16
					: row.original.accountCashRegister
						? "-"
						: row.original.accountSpark
							? "-"
							: row.original.accountNwc
								? "-"
								: row.original.accountIban
									? formatIban(row.original.accountIban.iban)
									: "-"
				: "-";
		},
	},
	{
		accessorKey: "currency",
		header: createSortableHeader(t("accounts:table.columns.currency")),
		cell: ({ row }) =>
			row.original.accountIban
				? row.original.accountIban.currency
				: row.original.accountCashRegister
					? row.original.accountCashRegister.currency
					: "-",
	},
	{
		accessorKey: "deviceName",
		header: createSortableHeader(t("tables:table.columns.device-name")),
		cell: ({ row }) =>
			row.original.deviceName && row.original.deviceId ? (
				<Button
					variant="link"
					onClick={(event) => {
						event.stopPropagation();
					}}
					render={
						<Link
							href={
								`/admin/devices/detail?id=${encodeURIComponent(row.original.deviceId)}` as never
							}
						/>
					}
				>
					{row.original.deviceName}
				</Button>
			) : (
				"-"
			),
	},
];

const sortingFields = {
	id: "account.id",
	deviceId: "device.id",
	deviceName: "device.name",
	createdAt: "account.createdAt",
	name: "account.name",
	_tag: "account._tag",
	accountLud16: "account._tag",
	accountCashRegister: "account._tag",
	accountSpark: "account._tag",
	accountNwc: "account._tag",
	accountIban: "account._tag",
} as const satisfies Record<keyof Task | "createdAt", string>;

const createFilterableColumns = (t: TFunction) =>
	[
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

				const sortingField = sorting ? sorting.id : ("createdAt" as const);
				const fullSortingField = sortingFields[sortingField];

				const finalSorting = {
					id: fullSortingField,
					desc: sorting ? sorting.desc : true,
				};

				const query = createQuery((db) => {
					let qb = db
						.selectFrom("account")
						.leftJoin("device", "account.deviceId", "device.id")
						.select(
							(eb) =>
								[
									"account.id as id",
									"account.name as name",
									"account.createdAt as createdAt",
									"account._tag as _tag",
									"device.id as deviceId",
									"device.name as deviceName",

									evoluJsonObjectFrom(
										eb
											.selectFrom("accountIban")
											.select([
												"accountIban.iban as iban",
												"accountIban.currency as currency",
											])
											.whereRef("accountIban.id", "=", "account.id")
											.where("accountIban.isDeleted", "is not", sqliteTrue)
											.where("accountIban.iban", "is not", null)
											.where("accountIban.currency", "is not", null)
											.$narrowType<{
												iban: KyselyNotNull;
												currency: KyselyNotNull;
											}>(),
									).as("accountIban"),

									evoluJsonObjectFrom(
										eb
											.selectFrom("accountLud16")
											.select(["accountLud16.lud16 as lud16"])
											.whereRef("accountLud16.id", "=", "account.id")
											.where("accountLud16.isDeleted", "is not", sqliteTrue)
											.where("accountLud16.lud16", "is not", null)
											.$narrowType<{
												lud16: KyselyNotNull;
											}>(),
									).as("accountLud16"),

									evoluJsonObjectFrom(
										eb
											.selectFrom("accountSpark")
											.select(["accountSpark.id as id"])
											.whereRef("accountSpark.id", "=", "account.id")
											.where("accountSpark.isDeleted", "is not", sqliteTrue),
									).as("accountSpark"),

									evoluJsonObjectFrom(
										eb
											.selectFrom("accountNwc")
											.select(["accountNwc.id as id"])
											.whereRef("accountNwc.id", "=", "account.id")
											.where("accountNwc.isDeleted", "is not", sqliteTrue),
									).as("accountNwc"),

									evoluJsonObjectFrom(
										eb
											.selectFrom("accountCashRegister")
											.select(["accountCashRegister.currency as currency"])
											.whereRef("accountCashRegister.id", "=", "account.id")
											.where(
												"accountCashRegister.isDeleted",
												"is not",
												sqliteTrue,
											)
											.where("accountCashRegister.currency", "is not", null)
											.$narrowType<{
												currency: KyselyNotNull;
											}>(),
									).as("accountCashRegister"),
								] as const,
						)
						.where("account.isDeleted", "is not", sqliteTrue)
						.$narrowType<{
							name: KyselyNotNull;
							_tag: KyselyNotNull;
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
									eb("account.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("account.id", "desc");

					for (const filter of filters) {
						if (filter.id === "name") {
							qb = qb.where(
								"account.name",
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
				<CardTitle>{t("accounts:table.accounts")}</CardTitle>
				<CardDescription>
					{t("accounts:table.description.list-of-your-accounts")}
				</CardDescription>
				<CardAction>
					<Link href={"/admin/accounts/new"}>
						<Button>
							<PlusIcon />
							{t("accounts:table.actions.new-account")}
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
							`/admin/accounts/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
