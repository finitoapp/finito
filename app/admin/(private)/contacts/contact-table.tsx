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
import {
	CountryCode,
	type Email,
	type NonEmptyString255,
	type Phone,
} from "@/lib/shared/types";

type ContactRow = {
	id: Id;
	deviceId: Id | null;
	deviceName: string | null;
	name: string;
	countryCode: CountryCode;
	phone: Phone | null;
	email: Email | null;
	vatNumber: NonEmptyString255 | null;
	identificationNumber: NonEmptyString255 | null;
	createdAt: DateIso;
};

const createColumns = (t: TFunction): ColumnDef<ContactRow, ContactRow>[] => [
	{
		accessorKey: "name",
		header: createSortableHeader(t("contacts:table.columns.name")),
	},
	{
		accessorKey: "phone",
		header: createSortableHeader(t("contacts:table.columns.phone")),
	},
	{
		accessorKey: "identificationNumber",
		header: createSortableHeader(
			t("contacts:table.columns.identification-number"),
		),
		cell: ({ row }) => {
			return row.original.countryCode === CountryCode.CZ
				? row.original.identificationNumber
				: "-";
		},
	},
	{
		accessorKey: "vatNumber",
		header: createSortableHeader(t("contacts:table.columns.vat-number")),
		cell: ({ row }) => {
			return row.original.countryCode === CountryCode.CZ
				? row.original.vatNumber
				: "-";
		},
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
	id: "contact.id",
	deviceId: "device.id",
	deviceName: "device.name",
	createdAt: "contact.createdAt",
	name: "contact.name",
	countryCode: "contactBillingInfo.countryCode",
	phone: "contact.phone",
	email: "contact.email",
	vatNumber: "contactBillingInfoCz.vatNumber",
	identificationNumber: "contactBillingInfoCz.identificationNumber",
} as const satisfies Record<keyof ContactRow, string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "name",
			title: t("contacts:table.columns.name"),
		},
	] satisfies { id: keyof ContactRow; title: string }[];

export function ContactTable() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("contacts");
	const columns = useMemo(() => createColumns(t), [t]);
	const filterableColumns = useMemo(() => createFilterableColumns(t), [t]);
	const onFilterChange = useMemo<DataTableOnFilterChange<ContactRow>>(
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
						.selectFrom("contact")
						.leftJoin("device", "device.id", "contact.deviceId")
						.leftJoin(
							"contactBillingInfo",
							"contactBillingInfo.id",
							"contact.id",
						)
						.leftJoin(
							"contactBillingInfoCz",
							"contactBillingInfoCz.id",
							"contact.id",
						)
						.select([
							"contact.id as id",
							"device.id as deviceId",
							"device.name as deviceName",
							"contact.name as name",
							"contact.label as label",
							"contactBillingInfo.countryCode as countryCode",
							"contact.phone as phone",
							"contact.email as email",
							"contact.createdAt as createdAt",
							"contactBillingInfoCz.vatNumber as vatNumber",
							"contactBillingInfoCz.identificationNumber as identificationNumber",
						] as const)
						.where("contact.isDeleted", "is not", sqliteTrue)
						.where("contact.name", "is not", null)
						.where("contactBillingInfo.countryCode", "is not", null)
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
									eb("contact.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("contact.id", "desc");

					for (const filter of filters) {
						if (filter.id === "name") {
							qb = qb.where(
								"contact.name",
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
				<CardTitle>{t("contacts:table.contacts")}</CardTitle>
				<CardDescription>
					{t("contacts:table.listOfYourContacts")}
				</CardDescription>
				<CardAction>
					<Link href={"/admin/contacts/new"}>
						<Button>
							<PlusIcon />
							{t("contacts:table.actions.new-contact")}
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
							`/admin/contacts/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
