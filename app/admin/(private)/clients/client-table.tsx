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
import { CountryCode, type NonEmptyString255 } from "@/lib/shared/types";

type Task = {
	id: Id;
	name: string;
	countryCode: CountryCode;
	vatNumber: NonEmptyString255 | null;
	identificationNumber: NonEmptyString255 | null;
	createdAt: DateIso;
};

const createColumns = (t: TFunction): ColumnDef<Task, Task>[] => [
	{
		accessorKey: "name",
		header: createSortableHeader(t("clients:table.columns.name")),
	},
	{
		accessorKey: "identificationNumber",
		header: createSortableHeader(
			t("clients:table.columns.identification-number"),
		),
		cell: ({ row }) => {
			return row.original.countryCode === CountryCode.CZ
				? row.original.identificationNumber
				: "-";
		},
	},
	{
		accessorKey: "vatNumber",
		header: createSortableHeader(t("clients:table.columns.vat-number")),
		cell: ({ row }) => {
			return row.original.countryCode === CountryCode.CZ
				? row.original.vatNumber
				: "-";
		},
	},
];

const sortingFields = {
	id: "client.id",
	createdAt: "client.createdAt",
	name: "client.name",
	countryCode: "client.countryCode",
	vatNumber: "clientCz.vatNumber",
	identificationNumber: "clientCz.identificationNumber",
} as const satisfies Record<keyof Task, string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "name",
			title: t("clients:table.columns.name"),
		},
	] satisfies { id: keyof Task; title: string }[];

export function ClientTable() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("clients");
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
						.selectFrom("client")
						.leftJoin("clientAddress", "clientAddress.id", "client.id")
						.leftJoin("clientCz", "clientCz.id", "client.id")
						.select([
							"client.id as id",
							"client.name as name",
							"client.label as label",
							"client.countryCode as countryCode",
							"client.createdAt as createdAt",
							"clientCz.vatNumber as vatNumber",
							"clientCz.identificationNumber as identificationNumber",
						] as const)
						.where("client.isDeleted", "is not", sqliteTrue)
						.where("client.name", "is not", null)
						.where("client.countryCode", "is not", null)
						.$narrowType<{
							name: KyselyNotNull;
							countryCode: KyselyNotNull;
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
									eb("client.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("client.id", "desc");

					for (const filter of filters) {
						if (filter.id === "name") {
							qb = qb.where(
								"client.name",
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
					<CardTitle>{t("clients:table.clients")}</CardTitle>
					<CardDescription>
						{t("clients:table.listOfYourClients")}
					</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/clients/new"}>
						<Button>
							<PlusIcon />
							{t("clients:table.actions.new-client")}
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
						router.push(
							`/admin/clients/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
