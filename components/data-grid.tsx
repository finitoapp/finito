"use client";

import type React from "react";
import { Fragment, useState } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface Column<T> {
	key: keyof T;
	header: string;
	width?: string;
	render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataGridProps<T> {
	data: T[] | undefined;
	columns: Column<T>[];
	onRowClick?: (row: T, index: number) => void;
	className?: string;
	rowClassName?: string | ((row: T, index: number) => string);
}

export function DataGrid<T extends Record<string, unknown>>({
	data,
	columns,
	onRowClick,
	className,
	rowClassName,
}: DataGridProps<T>) {
	const [hoveredRow, setHoveredRow] = useState<number | null>(null);
	const isMobile = useMediaQuery("(max-width: 768px)");

	const getRowClassName = (row: T | undefined, index: number) => {
		const baseClasses = "border-b transition-colors";
		const clickableClasses = onRowClick
			? "cursor-pointer hover:bg-muted/50"
			: "";
		const hoverClasses = hoveredRow === index ? "bg-muted/50" : "";

		if (typeof rowClassName === "function") {
			return cn(
				baseClasses,
				clickableClasses,
				hoverClasses,
				row ? rowClassName(row, index) : undefined,
			);
		}

		return cn(baseClasses, clickableClasses, hoverClasses, rowClassName);
	};

	return (
		<>
			{isMobile ? (
				<Table className={className}>
					<TableBody>
						{data === undefined || data.length === 0 ? (
							<TableRow className={getRowClassName(undefined, 0)}>
								<TableCell className={"text-center"}>
									{data === undefined ? "Loading..." : "No data available"}
								</TableCell>
							</TableRow>
						) : (
							data.map((row, index) => (
								<Fragment
									// biome-ignore lint/suspicious/noArrayIndexKey: we don't have a better value
									key={index}
								>
									{columns.map((column, index2) => (
										<TableRow
											className={cn(
												getRowClassName(row, index),
												index2 < columns.length - 1 ? "border-0" : "",
											)}
											key={String(column.key)}
											onClick={() => onRowClick?.(row, index)}
											onMouseEnter={() => setHoveredRow(index)}
											onMouseLeave={() => setHoveredRow(null)}
										>
											<TableCell
												className={"bg-muted/50 py-2 font-medium text-right"}
											>
												{column.header}
											</TableCell>
											<TableCell className={"py-2"}>
												{column.render
													? column.render(row[column.key], row)
													: String(row[column.key] ?? "")}
											</TableCell>
										</TableRow>
									))}
								</Fragment>
							))
						)}
					</TableBody>
				</Table>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							{columns.map((column) => (
								<TableHead
									key={String(column.key)}
									className={cn(column.width && `w-[${column.width}]`)}
								>
									{column.header}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{data === undefined || data.length === 0 ? (
							<TableRow className={getRowClassName(undefined, 0)}>
								<TableCell colSpan={columns.length} className={"text-center"}>
									{data === undefined ? "Loading..." : "No data available"}
								</TableCell>
							</TableRow>
						) : (
							data.map((row, index) => (
								<TableRow
									// biome-ignore lint/suspicious/noArrayIndexKey: we don't have a better value
									key={index}
									className={getRowClassName(row, index)}
									onClick={() => onRowClick?.(row, index)}
									onMouseEnter={() => setHoveredRow(index)}
									onMouseLeave={() => setHoveredRow(null)}
								>
									{columns.map((column) => (
										<TableCell key={String(column.key)}>
											{column.render
												? column.render(row[column.key], row)
												: String(row[column.key] ?? "")}
										</TableCell>
									))}
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			)}
		</>
	);
}
