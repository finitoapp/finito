"use client";

import {
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnSort,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type OnChangeFn,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import * as React from "react";
import { useEffectEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export type FilterValue<TData extends Record<string, unknown>> = {
	id: keyof TData;
	value: string | undefined;
};

export type SortValue<TData extends Record<string, unknown>> = {
	id: keyof TData;
	desc: boolean;
};

export type PaginationParams = {
	cursor?: string;
	limit: number;
};

export type DataParams<TData extends Record<string, unknown>> = {
	filters: FilterValue<TData>[];
	sorting?: SortValue<TData>;
	pagination: PaginationParams;
	setData: (data: PaginationResponse<TData>) => void;
};

export type PaginationResponse<TData extends Record<string, unknown>> = {
	data: TData[];
	cursor?: string;
};

export type DataTableOnFilterChange<TData extends Record<string, unknown>> = (
	params: DataParams<TData>,
) => () => void;

interface DataTableProps<TData extends Record<string, unknown>, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data?: PaginationResponse<TData>;
	pageSize?: number;
	onFilterChange?: DataTableOnFilterChange<TData>;
	filterableColumns?: {
		id: string;
		title: string;
		options?: { label: string; value: string }[];
	}[];
	isLoading?: boolean;
	onRowClick?: (row: TData) => void;
	columnVisibilityDriver: {
		set: OnChangeFn<VisibilityState>;
		subscribe: (callback: (visibility: VisibilityState) => void) => () => void;
	};
}

export function DataTable<TData extends Record<string, unknown>, TValue>({
	columns,
	data: initialData,
	pageSize = 15,
	onFilterChange,
	filterableColumns = [],
	onRowClick,
	columnVisibilityDriver,
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	);
	const [debouncedFilters, setDebouncedFilters] =
		React.useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState | null>(null);
	const [rowSelection, setRowSelection] = React.useState({});
	const [data, setData] = React.useState<TData[]>(initialData?.data ?? []);
	const [isLoading, setIsLoading] = React.useState(data === undefined);
	const [nextCursor, setNextCursor] = React.useState<string | undefined>(
		undefined,
	);
	const [currentCursor, setCurrentCursor] = React.useState<string | undefined>(
		undefined,
	);
	const [cursorHistory, setCursorHistory] = React.useState<string[]>([]);

	// Debounce filters (500ms delay)
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedFilters(columnFilters);
		}, 500);

		return () => clearTimeout(timer);
	}, [columnFilters]);

	React.useEffect(() => {
		return columnVisibilityDriver.subscribe((columnVisibility) => {
			setColumnVisibility(columnVisibility);
		});
	}, []);

	// Handle external filtering
	React.useEffect(() => {
		setIsLoading(true);
		try {
			const filters: FilterValue<TData>[] = debouncedFilters.map((filter) => ({
				id: filter.id,
				value: filter.value as string | undefined,
			}));

			let unsubscribed = false;
			const unsubscribe = onFilterChange({
				filters,
				sorting: sorting[0],
				setData: (result) => {
					// ignore when another fetchData has been called
					if (unsubscribed) {
						return;
					}

					setIsLoading(false);
					setData(result.data);
					setNextCursor(result.cursor);
				},
				pagination: {
					cursor: currentCursor,
					limit: pageSize,
				},
			});

			return () => {
				unsubscribed = true;
				unsubscribe();
			};
		} catch (error) {
			console.error("[v0] Error fetching filtered data:", error);
		}
	}, [debouncedFilters, sorting, onFilterChange, pageSize, currentCursor]);

	// Reset cursor when filters or sorting change
	// biome-ignore lint/correctness/useExhaustiveDependencies: It's OK
	React.useEffect(() => {
		if (onFilterChange) {
			setCursorHistory([]);
		}
	}, [debouncedFilters, sorting, onFilterChange]);

	const table = useReactTable({
		data,
		columns,
		onSortingChange: setSorting,
		enableMultiSort: false,
		enableSortingRemoval: true,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		// Only use client-side filtering if no external callback
		getSortedRowModel: onFilterChange ? undefined : getSortedRowModel(),
		getFilteredRowModel: onFilterChange ? undefined : getFilteredRowModel(),
		onColumnVisibilityChange: columnVisibilityDriver.set,
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility: columnVisibility ?? {},
			rowSelection,
			pagination: {
				pageIndex: 0,
				pageSize,
			},
		},
	});

	return (
		<div className="w-full">
			<div className="flex flex-col gap-4 py-4">
				<div className="flex items-center gap-4">
					<div className="flex flex-wrap items-center gap-4">
						{filterableColumns.map((filterColumn) => {
							const column = table.getColumn(filterColumn.id);
							if (!column) return null;

							if (filterColumn.options) {
								return (
									<DropdownMenu key={filterColumn.id}>
										<DropdownMenuTrigger asChild>
											<Button
												variant="outline"
												size="sm"
												className="h-9 bg-transparent"
											>
												{filterColumn.title}
												{column.getFilterValue() && (
													<span className="ml-2 rounded-sm bg-primary px-1 text-xs text-primary-foreground">
														1
													</span>
												)}
												<ChevronDown className="ml-2 h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start" className="w-50">
											{filterColumn.options.map((option) => {
												const isSelected =
													column.getFilterValue() === option.value;
												return (
													<DropdownMenuCheckboxItem
														key={option.value}
														checked={isSelected}
														onCheckedChange={() => {
															column.setFilterValue(
																isSelected ? undefined : option.value,
															);
														}}
													>
														{option.label}
													</DropdownMenuCheckboxItem>
												);
											})}
										</DropdownMenuContent>
									</DropdownMenu>
								);
							}

							return (
								<Input
									key={filterColumn.id}
									placeholder={`Filter ${filterColumn.title.toLowerCase()}...`}
									value={(column.getFilterValue() as string) ?? ""}
									onChange={(event) =>
										column.setFilterValue(event.target.value)
									}
									className="h-9 w-50"
								/>
							);
						})}
						{columnFilters.length > 0 && (
							<Button
								variant="ghost"
								onClick={() => table.resetColumnFilters()}
								className="h-9 px-2 lg:px-3"
							>
								Reset
							</Button>
						)}
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" className="ml-auto bg-transparent">
								Columns <ChevronDown className="ml-2 h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{table
								.getAllColumns()
								.filter((column) => column.getCanHide())
								.map((column) => {
									return (
										<DropdownMenuCheckboxItem
											key={column.id}
											className="capitalize"
											checked={column.getIsVisible()}
											onCheckedChange={(value) =>
												column.toggleVisibility(!!value)
											}
										>
											{column.id}
										</DropdownMenuCheckboxItem>
									);
								})}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{isLoading || columnVisibility === null ? (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									<div className="flex items-center justify-center">
										<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
										<span className="ml-2 text-sm text-muted-foreground">
											Loading...
										</span>
									</div>
								</TableCell>
							</TableRow>
						) : table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									onClick={() => onRowClick?.(row.original)}
									className={onRowClick ? "cursor-pointer" : undefined}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-end gap-2 py-4">
				<div className="flex-1 text-sm text-muted-foreground">
					{table.getFilteredSelectedRowModel().rows.length} of{" "}
					{table.getFilteredRowModel().rows.length} row(s) selected.
				</div>
				<div className="flex items-center gap-2">
					{onFilterChange ? (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const newHistory = cursorHistory.slice(0, -1);
									setCursorHistory(newHistory);
									setCurrentCursor(newHistory[newHistory.length - 1]);
								}}
								disabled={cursorHistory.length === 0 || isLoading}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									if (nextCursor) {
										setCursorHistory([...cursorHistory, nextCursor]);
										setCurrentCursor(nextCursor);
									}
								}}
								disabled={nextCursor === undefined || isLoading}
							>
								Next
							</Button>
						</>
					) : (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								Next
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

export function createSortableHeader(title: string) {
	return ({ column }: { column: any }) => {
		return (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
			>
				{title}
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		);
	};
}
