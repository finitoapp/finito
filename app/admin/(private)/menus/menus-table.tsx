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
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useDataTableVisibilityDriver } from "@/hooks/use-data-table-visibility-driver";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { isMenuVisibleForPublic } from "@/lib/menu/utils";

type MenuRow = {
	id: Id;
	deviceId: Id | null;
	deviceName: string | null;
	name: string;
	status: string;
	publishedAt: number | null;
};

const getStatusLabel = (t: TFunction, value: string) => {
	if (value === MenuStatus.Draft) return t("menus:status.draft");
	if (value === MenuStatus.Published) return t("menus:status.published");
	return value;
};

const createColumns = (t: TFunction): ColumnDef<MenuRow>[] => [
	{
		accessorKey: "name",
		header: createSortableHeader(t("menus:table.columns.name")),
	},
	{
		accessorKey: "status",
		header: createSortableHeader(t("menus:table.columns.status")),
		cell: ({ row }) => getStatusLabel(t, row.original.status),
	},
	{
		accessorKey: "publishedAt",
		header: createSortableHeader(t("menus:table.columns.publishedAt")),
		cell: ({ row }) =>
			row.original.publishedAt === null
				? t("menus:common.always")
				: new Date(row.original.publishedAt).toLocaleString(),
	},
	{
		id: "visible",
		accessorFn: (row) =>
			isMenuVisibleForPublic({
				status: row.status,
				publishedAt: row.publishedAt,
			}),
		enableSorting: false,
		header: t("menus:table.columns.visible"),
		cell: ({ row }) =>
			isMenuVisibleForPublic({
				status: row.original.status,
				publishedAt: row.original.publishedAt,
			})
				? t("menus:common.yes")
				: t("menus:common.no"),
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
	id: "menu.id",
	deviceId: "device.id",
	deviceName: "device.name",
	name: "menu.name",
	status: "menu.status",
	publishedAt: "menu.publishedAt",
} as const satisfies Record<keyof MenuRow, string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "name",
			title: t("menus:table.columns.name"),
		},
	] satisfies { id: keyof MenuRow; title: string }[];

export const MenusTable = () => {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver("menus");
	const columns = useMemo(() => createColumns(t), [t]);
	const filterableColumns = useMemo(() => createFilterableColumns(t), [t]);

	const onFilterChange = useMemo<DataTableOnFilterChange<MenuRow>>(
		() =>
			({ filters, sorting, setData, pagination: { limit, cursor } }) => {
				const previousCursor =
					cursor !== undefined ? JSON.parse(cursor) : undefined;
				const sortingField = sorting ? sorting.id : ("name" as const);
				const sortingColumn = sortingFields[sortingField];
				const finalSorting = {
					id: sortingColumn,
					desc: sorting?.desc ?? false,
				};

				const query = createQuery((db) => {
					let qb = db
						.selectFrom("menu")
						.leftJoin("device", "device.id", "menu.deviceId")
						.select([
							"menu.id as id",
							"device.id as deviceId",
							"device.name as deviceName",
							"menu.name as name",
							"menu.status as status",
							"menu.publishedAt as publishedAt",
						] as const)
						.where("menu.isDeleted", "is not", sqliteTrue);

					if (previousCursor) {
						qb = qb.where((eb) =>
							eb.or([
								eb(
									finalSorting.id,
									finalSorting.desc ? "<" : ">",
									previousCursor[sortingField],
								),
								eb.and([
									eb(finalSorting.id, "=", previousCursor[sortingField]),
									eb("menu.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("menu.id", "desc");

					for (const filter of filters) {
						if (filter.id === "name") {
							qb = qb.where("menu.name", "like", `${filter.value}%` as never);
						}
					}

					return qb.limit(limit + 1);
				});

				const normalizeRows = (
					rows: ReadonlyArray<{
						id: Id;
						deviceId: Id | null;
						deviceName: string | null;
						name: string | null;
						status: string | null;
						publishedAt: number | null;
					}>,
				): MenuRow[] =>
					rows.flatMap((row) =>
						row.name === null || row.status === null
							? []
							: [
									{
										id: row.id,
										deviceId: row.deviceId,
										deviceName: row.deviceName,
										name: row.name,
										status: row.status,
										publishedAt: row.publishedAt,
									},
								],
					);

				const formatData = (result: ReadonlyArray<MenuRow>) => {
					const rawData = result.length > limit ? result.slice(0, -1) : result;
					const data = [...rawData];
					let nextCursor: undefined | Record<string, unknown>;
					const last = data[data.length - 1];
					if (result.length > limit && last) {
						nextCursor = {
							id: last.id,
							[sortingField]: last[sortingField],
						};
					}

					return {
						data,
						cursor:
							nextCursor !== undefined ? JSON.stringify(nextCursor) : undefined,
					};
				};

				void evolu.loadQuery(query).then((rows) => {
					setData(formatData(normalizeRows(rows)));
				});

				return evolu.subscribeQuery(query)(() => {
					setData(formatData(normalizeRows(evolu.getQueryRows(query))));
				});
			},
		[evolu],
	);

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardTitle>{t("menus:table.menus")}</CardTitle>
				<CardDescription>{t("menus:table.listOfMenus")}</CardDescription>
				<CardAction>
					<Link href={"/admin/menus/new" as never}>
						<Button>
							<PlusIcon />
							{t("menus:table.actions.new-menu")}
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
					onRowClick={(menu) =>
						router.push(
							`/admin/menus/detail?id=${encodeURIComponent(menu.id)}` as never,
						)
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
};
