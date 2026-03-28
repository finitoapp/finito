"use client";

import {
	type ColumnDef,
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type OnChangeFn,
	type PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, Settings2Icon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { DataGrid } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/components/reui/data-grid/data-grid-column-visibility";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

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
	onFilterChange,
	filterableColumns = [],
	onRowClick,
	columnVisibilityDriver,
}: DataTableProps<TData, TValue>) {
	const { t } = useTranslation();
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
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 15,
	});
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
	}, [columnVisibilityDriver]);

	// Handle external filtering
	React.useEffect(() => {
		setIsLoading(true);
		try {
			const filters: FilterValue<TData>[] = debouncedFilters.map((filter) => ({
				id: filter.id,
				value: filter.value as string | undefined,
			}));

			let unsubscribed = false;
			const unsubscribe = onFilterChange
				? onFilterChange({
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
							limit: pagination.pageSize,
						},
					})
				: () => {};

			return () => {
				unsubscribed = true;
				unsubscribe();
			};
		} catch (error) {
			console.error("[v0] Error fetching filtered data:", error);
		}
	}, [
		debouncedFilters,
		sorting,
		onFilterChange,
		pagination.pageSize,
		currentCursor,
	]);

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
			pagination,
		},
		onPaginationChange: setPagination,
		manualPagination: true,
	});

	return (
		<DataGrid
			table={table}
			recordCount={data.length}
			tableLayout={{ rowsPinnable: true }}
			tableClassNames={{
				edgeCell: "px-6",
			}}
			onRowClick={onRowClick}
		>
			<Card className="w-full gap-3 py-0 ring-0">
				<CardHeader className="flex flex-wrap items-start justify-between gap-2 border-none">
					<div className={"flex min-w-0 flex-1 flex-wrap items-center gap-2.5"}>
						{filterableColumns.map((filterColumn) => {
							const column = table.getColumn(filterColumn.id);
							if (!column) return null;

							if (filterColumn.options) {
								return (
									<DropdownMenu key={filterColumn.id}>
										<DropdownMenuTrigger
											render={
												<Button
													variant="outline"
													size="sm"
													className="h-9 max-w-full bg-transparent"
												/>
											}
										>
											{filterColumn.title}
											{column.getFilterValue() ? (
												<span className="ml-2 rounded-sm bg-primary px-1 text-xs text-primary-foreground">
													1
												</span>
											) : null}
											<ChevronDown className="ml-2 h-4 w-4" />
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
									placeholder={t("components:dataTable.filterPlaceholder", {
										title: filterColumn.title,
									})}
									value={(column.getFilterValue() as string) ?? ""}
									onChange={(event) =>
										column.setFilterValue(event.target.value)
									}
									className="w-50 max-w-full min-w-40"
								/>
							);
						})}
						{columnFilters.length > 0 && (
							<Button
								variant="ghost"
								onClick={() => table.resetColumnFilters()}
								className="px-2 lg:px-3"
							>
								{t("components:dataTable.reset")}
							</Button>
						)}
					</div>
					<CardAction className="ml-auto">
						<DataGridColumnVisibility
							table={table}
							trigger={
								<Button variant="outline">
									<Settings2Icon aria-hidden="true" />
									Columns
								</Button>
							}
						/>
					</CardAction>
				</CardHeader>
				<CardContent className="border-y px-0">
					<DataGridScrollArea>
						<DataGridTable />
					</DataGridScrollArea>
				</CardContent>
				<CardFooter className="border-none bg-transparent! py-0 justify-end gap-2">
					<div className="flex-1 text-sm text-muted-foreground">
						{t("components:dataTable.selectedRows", {
							selected: table.getFilteredSelectedRowModel().rows.length,
							total: table.getFilteredRowModel().rows.length,
						})}
					</div>
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
								{t("components:dataTable.previous")}
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
								{t("components:dataTable.next")}
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
								{t("components:dataTable.previous")}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								{t("components:dataTable.next")}
							</Button>
						</>
					)}
				</CardFooter>
			</Card>
		</DataGrid>
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
