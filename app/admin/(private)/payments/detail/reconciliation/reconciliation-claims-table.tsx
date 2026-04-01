"use client";

import { type DateIso, type Id, sqliteTrue } from "@evolu/common";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	createSortableHeader,
	DataTable,
	type DataTableOnFilterChange,
} from "@/components/data-table";
import { ResponsiveCard } from "@/components/responsive-card";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useDataTableVisibilityDriver } from "@/hooks/use-data-table-visibility-driver";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";

type ReconciliationClaimRow = {
	id: Id;
	deviceId: Id | null;
	sourceType: string | null;
	sourceId: Id | null;
	rule: string | null;
	confidence: number | null;
	createdBy: string | null;
	createdAt: DateIso;
};

const sortingFields = {
	id: "reconciliationClaim.id",
	deviceId: "reconciliationClaim.deviceId",
	sourceType: "reconciliationClaim.sourceType",
	createdAt: "reconciliationClaim.createdAt",
	sourceId: "reconciliationClaim.sourceId",
	rule: "reconciliationClaim.rule",
	confidence: "reconciliationClaim.confidence",
	createdBy: "reconciliationClaim.createdBy",
} as const satisfies Record<keyof ReconciliationClaimRow | "createdAt", string>;

const createColumns = (t: TFunction): ColumnDef<ReconciliationClaimRow>[] => [
	{
		accessorKey: "createdAt",
		header: createSortableHeader(
			t("payments:detail.reconciliation.columns.created-at"),
		),
		cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
	},
	{
		accessorKey: "id",
		header: createSortableHeader(
			t("payments:detail.reconciliation.columns.id"),
		),
		cell: ({ row }) => (
			<span className="font-mono text-xs">{row.original.id}</span>
		),
	},
	{
		accessorKey: "deviceId",
		header: t("payments:detail.reconciliation.columns.device-id"),
		enableSorting: false,
		cell: ({ row }) => (
			<span className="font-mono text-xs">{row.original.deviceId ?? "-"}</span>
		),
	},
	{
		accessorKey: "sourceType",
		header: t("payments:detail.reconciliation.columns.source-type"),
		enableSorting: false,
		cell: ({ row }) => row.original.sourceType ?? "-",
	},
	{
		accessorKey: "sourceId",
		header: t("payments:detail.reconciliation.columns.source-id"),
		enableSorting: false,
		cell: ({ row }) => (
			<span className="font-mono text-xs">{row.original.sourceId ?? "-"}</span>
		),
	},
	{
		accessorKey: "rule",
		header: t("payments:detail.reconciliation.columns.rule"),
		enableSorting: false,
		cell: ({ row }) => row.original.rule ?? "-",
	},
	{
		accessorKey: "confidence",
		header: t("payments:detail.reconciliation.columns.confidence"),
		enableSorting: false,
		cell: ({ row }) => row.original.confidence ?? "-",
	},
	{
		accessorKey: "createdBy",
		header: t("payments:detail.reconciliation.columns.created-by"),
		enableSorting: false,
		cell: ({ row }) => row.original.createdBy ?? "-",
	},
];

export const ReconciliationClaimsTable = (props: { paymentId: Id }) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const columnVisibilityDriver = useDataTableVisibilityDriver(
		"payments-reconciliation-claims",
	);
	const columns = useMemo(() => createColumns(t), [t]);
	const onFilterChange = useMemo<
		DataTableOnFilterChange<ReconciliationClaimRow>
	>(
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
						.selectFrom("reconciliationClaim")
						.select([
							"reconciliationClaim.id as id",
							"reconciliationClaim.deviceId as deviceId",
							"reconciliationClaim.sourceType as sourceType",
							"reconciliationClaim.sourceId as sourceId",
							"reconciliationClaim.rule as rule",
							"reconciliationClaim.confidence as confidence",
							"reconciliationClaim.createdBy as createdBy",
							"reconciliationClaim.createdAt as createdAt",
						] as const)
						.where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
						.where("reconciliationClaim.entityType", "=", "payment")
						.where("reconciliationClaim.entityId", "=", props.paymentId);

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
									eb("reconciliationClaim.id", "<", previousCursor.id as Id),
								]),
							]),
						);
					}

					qb = qb
						.orderBy(finalSorting.id, finalSorting.desc ? "desc" : "asc")
						.orderBy("reconciliationClaim.id", "desc");

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
		[evolu, props.paymentId],
	);

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardTitle>{t("payments:detail.reconciliation.title")}</CardTitle>
				<CardDescription>
					{t("payments:detail.reconciliation.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className={"px-0"}>
				<DataTable
					columns={columns}
					columnVisibilityDriver={columnVisibilityDriver}
					onFilterChange={onFilterChange}
				/>
			</CardContent>
		</ResponsiveCard>
	);
};
