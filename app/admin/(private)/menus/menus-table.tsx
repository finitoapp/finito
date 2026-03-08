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
import { createQuery } from "@/lib/evolu";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { isMenuVisibleForPublic } from "@/lib/menu/utils";

type MenuRow = {
	id: Id;
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
];

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
				const finalSorting = sorting ?? { id: "name", desc: false };
				const sortingColumn = `menu.${finalSorting.id}`;

				const query = createQuery((db) => {
					let qb = db
						.selectFrom("menu")
						.select([
							"menu.id as id",
							"menu.name as name",
							"menu.status as status",
							"menu.publishedAt as publishedAt",
						] as const)
						.where("menu.isDeleted", "is not", sqliteTrue);

					if (previousCursor) {
						qb = qb.where((eb) =>
							eb.or([
								eb(
									sortingColumn as never,
									finalSorting.desc ? "<" : ">",
									previousCursor[finalSorting.id],
								),
								eb.and([
									eb(
										sortingColumn as never,
										"=",
										previousCursor[finalSorting.id],
									),
									eb("menu.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(sortingColumn as never, finalSorting.desc ? "desc" : "asc")
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
							[finalSorting.id]: last[finalSorting.id as keyof MenuRow],
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
				<CardHeading className={"py-6"}>
					<CardTitle>{t("menus:table.menus")}</CardTitle>
					<CardDescription>{t("menus:table.listOfMenus")}</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/menus/new" as never}>
						<Button>
							<PlusIcon />
							{t("menus:table.actions.new-menu")}
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
