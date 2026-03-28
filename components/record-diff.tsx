"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/shared/ui/cn";

export type RecordValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| Date
	| object;

export type RecordData = Record<string, RecordValue>;

export interface RecordDiffProps {
	before: RecordData;
	after: RecordData;
	labels?: Record<string, string>;
	beforeLabel?: string;
	afterLabel?: string;
	className?: string;
}

type ChangeKind = "added" | "removed" | "changed" | "unchanged";

interface DiffRow {
	key: string;
	label: string;
	kind: ChangeKind;
	before: RecordValue;
	after: RecordValue;
}

function isDate(val: RecordValue): val is Date {
	return val instanceof Date;
}

function isObject(val: RecordValue): val is object {
	return val !== null && typeof val === "object" && !isDate(val);
}

function deepEqual(a: RecordValue, b: RecordValue): boolean {
	if (a === b) return true;
	if (isDate(a) && isDate(b)) return a.getTime() === b.getTime();
	if (isObject(a) && isObject(b))
		return JSON.stringify(a) === JSON.stringify(b);
	return false;
}

function buildRows(
	before: RecordData,
	after: RecordData,
	labels: Record<string, string>,
): DiffRow[] {
	const allKeys = Array.from(
		new Set([...Object.keys(before), ...Object.keys(after)]),
	);

	return allKeys.map((key) => {
		const bVal = before[key];
		const aVal = after[key];

		let kind: ChangeKind;
		if (!(key in before)) kind = "added";
		else if (!(key in after)) kind = "removed";
		else if (deepEqual(bVal, aVal)) kind = "unchanged";
		else kind = "changed";

		return {
			key,
			label: labels[key] ?? key,
			kind,
			before: bVal,
			after: aVal,
		};
	});
}

function formatScalar(val: RecordValue): string {
	if (val === null) return "null";
	if (val === undefined) return "—";
	if (typeof val === "boolean") return val ? "true" : "false";
	if (isDate(val)) return val.toISOString();
	if (typeof val === "string" || typeof val === "number") return String(val);
	return JSON.stringify(val, null, 2);
}

interface ValueCellProps {
	value: RecordValue;
	highlight?: "added" | "removed" | "neutral";
	empty?: boolean;
}

const valueHighlightClass = {
	added:
		"border-l-2 border-emerald-500/60 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100",
	removed:
		"border-l-2 border-rose-500/60 bg-rose-500/12 text-rose-950 dark:text-rose-100",
	neutral:
		"border-l-2 border-border bg-muted/35 text-muted-foreground dark:bg-muted/50",
};

function DiffValueCell({ value, highlight, empty }: ValueCellProps) {
	const isJson = isObject(value);
	const isDateVal = isDate(value);
	const raw = formatScalar(value);
	const isEmpty = empty || value === undefined;

	const bg = highlight
		? valueHighlightClass[highlight]
		: "border-l-2 border-transparent bg-background text-foreground";

	if (isEmpty) {
		return (
			<div
				className={cn(
					"flex h-full min-h-10 items-center px-3 py-2 text-sm",
					"bg-muted/20 text-muted-foreground italic",
				)}
			>
				—
			</div>
		);
	}

	return (
		<div className={cn("min-h-10 px-3 py-2 text-sm", bg)}>
			{isJson ? (
				<pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
					{JSON.stringify(value, null, 2)}
				</pre>
			) : isDateVal ? (
				<span className="font-mono text-xs">{raw}</span>
			) : (
				<span className="break-all leading-relaxed">{raw}</span>
			)}
		</div>
	);
}

const kindConfig: Record<ChangeKind, { className: string; rowClass: string }> =
	{
		added: {
			className:
				"border-emerald-600/35 bg-emerald-500/18 text-emerald-900 dark:text-emerald-100",
			rowClass: "bg-emerald-500/6",
		},
		removed: {
			className:
				"border-rose-600/35 bg-rose-500/18 text-rose-900 dark:text-rose-100",
			rowClass: "bg-rose-500/6",
		},
		changed: {
			className:
				"border-amber-600/35 bg-amber-500/20 text-amber-900 dark:text-amber-100",
			rowClass: "bg-amber-500/8",
		},
		unchanged: {
			className: "border-border bg-muted/80 text-muted-foreground",
			rowClass: "",
		},
	};

function KindBadge({ kind, label }: { kind: ChangeKind; label: string }) {
	const cfg = kindConfig[kind];
	return (
		<Badge
			variant="outline"
			className={cn("h-5 px-1.5 py-0 text-[10px] font-medium", cfg.className)}
		>
			{label}
		</Badge>
	);
}

export function RecordDiff({
	before,
	after,
	labels = {},
	beforeLabel,
	afterLabel,
	className,
}: RecordDiffProps) {
	const { t } = useTranslation();
	const showUnchangedId = React.useId();
	const [showUnchanged, setShowUnchanged] = React.useState(false);
	const rows = React.useMemo(
		() => buildRows(before, after, labels),
		[before, after, labels],
	);
	const kindLabels = React.useMemo(
		() => ({
			added: t("components:recordDiff.kind.added"),
			removed: t("components:recordDiff.kind.removed"),
			changed: t("components:recordDiff.kind.changed"),
			unchanged: t("components:recordDiff.kind.unchanged"),
		}),
		[t],
	);
	const resolvedBeforeLabel =
		beforeLabel ?? t("components:recordDiff.columns.before");
	const resolvedAfterLabel =
		afterLabel ?? t("components:recordDiff.columns.after");
	const visibleRows = showUnchanged
		? rows
		: rows.filter((row) => row.kind !== "unchanged");

	const stats = React.useMemo(() => {
		return {
			added: rows.filter((row) => row.kind === "added").length,
			removed: rows.filter((row) => row.kind === "removed").length,
			changed: rows.filter((row) => row.kind === "changed").length,
			unchanged: rows.filter((row) => row.kind === "unchanged").length,
		};
	}, [rows]);

	return (
		<div
			className={cn(
				"overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm",
				className,
			)}
		>
			<div className="flex items-center justify-between gap-4 border-b border-border bg-muted/30 px-4 py-3">
				<div className="flex items-center gap-2">
					<span className="text-sm font-semibold text-foreground">
						{t("components:recordDiff.title")}
					</span>
					<div className="inline-flex items-center gap-2">
						<Switch
							id={showUnchangedId}
							checked={showUnchanged}
							onCheckedChange={setShowUnchanged}
						/>
						<Label
							htmlFor={showUnchangedId}
							className="text-xs font-normal text-muted-foreground"
						>
							{t("components:recordDiff.actions.showUnchanged")}
						</Label>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-1.5">
					{stats.added > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/18 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:text-emerald-100">
							+{stats.added} {t("components:recordDiff.summary.added")}
						</span>
					)}
					{stats.removed > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-rose-500/18 px-2 py-0.5 text-[11px] font-medium text-rose-900 dark:text-rose-100">
							−{stats.removed} {t("components:recordDiff.summary.removed")}
						</span>
					)}
					{stats.changed > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100">
							~{stats.changed} {t("components:recordDiff.summary.changed")}
						</span>
					)}
					{stats.unchanged > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
							{stats.unchanged} {t("components:recordDiff.summary.unchanged")}
						</span>
					)}
				</div>
			</div>

			<Table className="min-w-[64rem] table-fixed">
				<TableHeader className="bg-muted/10">
					<TableRow className="hover:bg-transparent">
						<TableHead className="w-56 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{t("components:recordDiff.columns.field")}
						</TableHead>
						<TableHead className="w-32 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{t("components:recordDiff.columns.type")}
						</TableHead>
						<TableHead className="border-l border-border px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{resolvedBeforeLabel}
						</TableHead>
						<TableHead className="border-l border-border px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{resolvedAfterLabel}
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{visibleRows.length === 0 ? (
						<TableRow className="hover:bg-transparent">
							<TableCell
								colSpan={4}
								className="py-12 text-center text-sm text-muted-foreground"
							>
								{t("components:recordDiff.empty")}
							</TableCell>
						</TableRow>
					) : (
						visibleRows.map((row) => (
							<DiffTableRow key={row.key} row={row} kindLabels={kindLabels} />
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}

function DiffTableRow(props: {
	row: DiffRow;
	kindLabels: Record<ChangeKind, string>;
}) {
	const row = props.row;
	const isChanged = row.kind === "changed";
	const isAdded = row.kind === "added";
	const isRemoved = row.kind === "removed";

	const beforeHighlight: ValueCellProps["highlight"] =
		isChanged || isRemoved ? "removed" : isAdded ? "neutral" : undefined;
	const afterHighlight: ValueCellProps["highlight"] =
		isChanged || isAdded ? "added" : isRemoved ? "neutral" : undefined;

	return (
		<TableRow className={cn("align-top", kindConfig[row.kind].rowClass)}>
			<TableCell className="whitespace-normal px-4 py-2 align-top">
				<span className="truncate font-mono text-xs font-medium text-foreground">
					{row.label}
				</span>
				{row.label !== row.key && (
					<div className="truncate font-mono text-[10px] text-muted-foreground">
						{row.key}
					</div>
				)}
			</TableCell>

			<TableCell className="px-3 py-2 text-center align-top">
				<KindBadge kind={row.kind} label={props.kindLabels[row.kind]} />
			</TableCell>

			<TableCell className="border-l border-border p-0 whitespace-normal align-top">
				<DiffValueCell
					value={row.before}
					highlight={beforeHighlight}
					empty={row.kind === "added"}
				/>
			</TableCell>

			<TableCell className="border-l border-border p-0 whitespace-normal align-top">
				<DiffValueCell
					value={row.after}
					highlight={afterHighlight}
					empty={row.kind === "removed"}
				/>
			</TableCell>
		</TableRow>
	);
}
