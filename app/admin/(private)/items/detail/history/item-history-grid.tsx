"use client";

import {
	type DateIso,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { EyeIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	createSortableHeader,
	DataTable,
	type DataTableOnFilterChange,
} from "@/components/data-table";
import { RecordDiff } from "@/components/record-diff";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useDataTableVisibilityDriver } from "@/hooks/use-data-table-visibility-driver";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import type {
	Currency,
	Integer,
	NonEmptyString255,
	ProductCodeType,
} from "@/lib/shared/types";
import { formatDateTime, formatMoney } from "@/lib/shared/utils/format";

type ItemRevisionRow = {
	id: Id;
	deviceId: Id | null;
	itemId: Id | null;
	categoryId: Id | null;
	createdAt: DateIso;
	label: NonEmptyString255;
	price: Integer;
	currency: Currency;
	categoryName: string | null;
	unitOfMeasure: string | null;
	internalCode: string | null;
	productCodeType: ProductCodeType | null;
	productCodeValue: string | null;
};

type CurrentItemRow = {
	id: Id;
	deviceId: Id | null;
	categoryId: Id | null;
	label: NonEmptyString255;
	price: Integer;
	currency: Currency;
	unitOfMeasure: string | null;
	internalCode: string | null;
	productCodeType: ProductCodeType | null;
	productCodeValue: string | null;
	categoryName: string | null;
};

type DiffRowData = {
	label: NonEmptyString255;
	price: Integer;
	currency: Currency;
	categoryName: string | null;
	unitOfMeasure: string | null;
	internalCode: string | null;
	productCodeType: ProductCodeType | null;
	productCodeValue: string | null;
};

const toCurrentItemDiffData = (row: CurrentItemRow): DiffRowData => ({
	label: row.label,
	price: row.price,
	currency: row.currency,
	categoryName: row.categoryName,
	unitOfMeasure: row.unitOfMeasure,
	internalCode: row.internalCode,
	productCodeType: row.productCodeType,
	productCodeValue: row.productCodeValue,
});

const toRevisionDiffData = (row: ItemRevisionRow): DiffRowData => ({
	label: row.label,
	price: row.price,
	currency: row.currency,
	categoryName: row.categoryName,
	unitOfMeasure: row.unitOfMeasure,
	internalCode: row.internalCode,
	productCodeType: row.productCodeType,
	productCodeValue: row.productCodeValue,
});

const createDiffLabels = (t: TFunction) => ({
	label: t("items:table.columns.label"),
	price: t("items:table.columns.amount"),
	currency: t("items:form.item-form.label.currency"),
	categoryName: t("items:table.columns.category"),
	unitOfMeasure: t("items:detail.history.columns.unitOfMeasure"),
	internalCode: t("items:detail.history.columns.internalCode"),
	productCodeType: t("items:form.item-form.label.type"),
	productCodeValue: t("items:detail.history.columns.productCode"),
});

const createColumns = (
	t: TFunction,
	currentItem: CurrentItemRow | undefined,
	diffLabels: Record<string, string>,
): ColumnDef<ItemRevisionRow>[] => [
	{
		accessorKey: "createdAt",
		header: createSortableHeader(t("items:detail.history.columns.changedAt")),
		cell: ({ row }) => formatDateTime(new Date(row.original.createdAt)),
	},
	{
		accessorKey: "label",
		header: createSortableHeader(t("items:table.columns.label")),
	},
	{
		accessorKey: "price",
		header: createSortableHeader(t("items:table.columns.amount")),
		cell: ({ row }) =>
			formatMoney({
				value: row.original.price,
				currency: row.original.currency,
			}),
	},
	{
		accessorKey: "categoryName",
		header: t("items:table.columns.category"),
		enableSorting: false,
		cell: ({ row }) => row.original.categoryName ?? "-",
	},
	{
		accessorKey: "unitOfMeasure",
		header: t("items:detail.history.columns.unitOfMeasure"),
		enableSorting: false,
		cell: ({ row }) => row.original.unitOfMeasure ?? "-",
	},
	{
		accessorKey: "internalCode",
		header: t("items:detail.history.columns.internalCode"),
		enableSorting: false,
		cell: ({ row }) => row.original.internalCode ?? "-",
	},
	{
		accessorKey: "productCodeValue",
		header: t("items:detail.history.columns.productCode"),
		enableSorting: false,
		cell: ({ row }) => row.original.productCodeValue ?? "-",
	},
	{
		id: "actions",
		header: t("items:detail.history.columns.actions"),
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => {
			const revisionData = toRevisionDiffData(row.original);
			const currentData =
				currentItem === undefined
					? undefined
					: toCurrentItemDiffData(currentItem);

			return (
				<Dialog>
					<DialogTrigger
						render={
							<Button
								variant="outline"
								size="sm"
								disabled={currentData === undefined}
							/>
						}
					>
						<EyeIcon />
						{t("items:detail.history.actions.viewChanges")}
					</DialogTrigger>
					<DialogContent className="flex h-[92vh] !w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] sm:!max-w-[calc(100vw-1rem)] flex-col gap-0 p-0">
						<DialogHeader className="border-b px-6 py-4">
							<DialogTitle>{t("items:detail.history.diff.title")}</DialogTitle>
							<DialogDescription>
								{t("items:detail.history.diff.description", {
									changedAt: formatDateTime(new Date(row.original.createdAt)),
								})}
							</DialogDescription>
						</DialogHeader>
						<div className="min-h-0 flex-1 overflow-auto p-6">
							{currentData !== undefined && (
								<RecordDiff
									before={currentData}
									after={revisionData}
									labels={diffLabels}
									beforeLabel={t("items:detail.history.diff.current")}
									afterLabel={t("items:detail.history.diff.revision")}
								/>
							)}
						</div>
					</DialogContent>
				</Dialog>
			);
		},
	},
];

const sortingFields = {
	id: "itemRevision.id",
	deviceId: "itemRevision.deviceId",
	itemId: "itemRevision.itemId",
	categoryId: "itemRevision.categoryId",
	createdAt: "itemRevision.createdAt",
	label: "itemRevision.label",
	price: "itemRevision.price",
	currency: "itemRevision.currency",
	categoryName: "category.name",
	unitOfMeasure: "itemRevision.unitOfMeasure",
	internalCode: "itemRevision.internalCode",
	productCodeType: "itemRevision.productCodeType",
	productCodeValue: "itemRevision.productCodeValue",
} as const satisfies Record<keyof ItemRevisionRow, string>;

const createFilterableColumns = (t: TFunction) =>
	[
		{
			id: "label",
			title: t("items:table.columns.label"),
		},
		{
			id: "categoryName",
			title: t("items:table.columns.category"),
		},
		{
			id: "internalCode",
			title: t("items:detail.history.columns.internalCode"),
		},
		{
			id: "productCodeValue",
			title: t("items:detail.history.columns.productCode"),
		},
	] satisfies { id: keyof ItemRevisionRow; title: string }[];

export const ItemHistoryGrid = (props: { itemId: Id }) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const currentItemQuery = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("item")
					.leftJoin("category", "category.id", "item.categoryId")
					.select([
						"item.id as id",
						"item.deviceId as deviceId",
						"item.categoryId as categoryId",
						"item.label as label",
						"item.price as price",
						"item.currency as currency",
						"item.unitOfMeasure as unitOfMeasure",
						"item.internalCode as internalCode",
						"item.productCodeType as productCodeType",
						"item.productCodeValue as productCodeValue",
						"category.name as categoryName",
					] as const)
					.where("item.isDeleted", "is not", sqliteTrue)
					.where("item.id", "=", props.itemId)
					.where("item.label", "is not", null)
					.where("item.price", "is not", null)
					.where("item.currency", "is not", null)
					.$narrowType<{
						label: KyselyNotNull;
						price: KyselyNotNull;
						currency: KyselyNotNull;
					}>();
			}),
		[props.itemId],
	);
	const { data: currentItems } = useEvoluQuery(currentItemQuery);
	const currentItem = currentItems[0];
	const columnVisibilityDriver = useDataTableVisibilityDriver("items-history");
	const diffLabels = useMemo(() => createDiffLabels(t), [t]);
	const columns = useMemo(
		() => createColumns(t, currentItem, diffLabels),
		[t, currentItem, diffLabels],
	);
	const filterableColumns = useMemo(() => createFilterableColumns(t), [t]);

	const onFilterChange = useMemo<DataTableOnFilterChange<ItemRevisionRow>>(
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
						.selectFrom("itemRevision")
						.leftJoin("category", "category.id", "itemRevision.categoryId")
						.select([
							"itemRevision.id as id",
							"itemRevision.deviceId as deviceId",
							"itemRevision.itemId as itemId",
							"itemRevision.categoryId as categoryId",
							"itemRevision.createdAt as createdAt",
							"itemRevision.label as label",
							"itemRevision.price as price",
							"itemRevision.currency as currency",
							"itemRevision.unitOfMeasure as unitOfMeasure",
							"itemRevision.internalCode as internalCode",
							"itemRevision.productCodeType as productCodeType",
							"itemRevision.productCodeValue as productCodeValue",
							"category.name as categoryName",
						] as const)
						.where("itemRevision.isDeleted", "is not", sqliteTrue)
						.where("itemRevision.itemId", "=", props.itemId)
						.where("itemRevision.label", "is not", null)
						.where("itemRevision.price", "is not", null)
						.where("itemRevision.currency", "is not", null)
						.$narrowType<{
							label: KyselyNotNull;
							price: KyselyNotNull;
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
									eb("itemRevision.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("itemRevision.id", "desc");

					for (const filter of filters) {
						if (filter.id === "label") {
							qb = qb.where(
								"itemRevision.label",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}
						if (filter.id === "categoryName") {
							qb = qb.where(
								"category.name",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}
						if (filter.id === "internalCode") {
							qb = qb.where(
								"itemRevision.internalCode",
								"like",
								`${filter.value}%` as NonEmptyString255,
							);
						}
						if (filter.id === "productCodeValue") {
							qb = qb.where(
								"itemRevision.productCodeValue",
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
		[evolu, props.itemId],
	);

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardTitle>{t("items:detail.history.title")}</CardTitle>
				<CardDescription>
					{t("items:detail.history.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className={"px-0"}>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
					filterableColumns={filterableColumns}
				/>
			</CardContent>
		</ResponsiveCard>
	);
};
