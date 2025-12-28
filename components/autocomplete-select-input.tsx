import { LoaderCircleIcon } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { JsonValue } from "type-fest";
import type { AutoFormComponent } from "@/components/auto-form";
import {
	Autocomplete,
	AutocompleteClear,
	AutocompleteContent,
	AutocompleteControl,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
	AutocompleteStatus,
} from "@/components/ui/base-autocomplete";
import { FormField } from "@/components/ui/form";
import { Label } from "@/components/ui/label";

export const createAutocompleteSelectInput =
	<TItem extends JsonValue>(params: {
		fetchItems: (search: string) => Promise<TItem[]>;
		itemToStringValue: (item: TItem) => string;
		itemToKeyValue: (item: TItem) => string;
		ListItemComponent: React.FC<{ item: TItem }>;
		fetchFailedErrorMessage?: string;
		noItemsErrorMessage?: string;
		emptySearchErrorMessage?: string;
		placeholder?: string;
	}): AutoFormComponent<TItem> =>
	(props) => {
		return (
			<FormField
				control={props.control}
				name={props.name}
				render={({ field }) => {
					const lastValue = useRef<TItem | null>(null);
					const [searchValue, setSearchValue] = useState("");
					const [isLoading, setIsLoading] = useState(false);
					const [searchResults, setSearchResults] = useState<TItem[]>([]);
					const [error, setError] = useState<string | null>(null);
					useEffect(() => {
						if (!searchValue) {
							setIsLoading(false);
							setSearchResults([]);
							return undefined;
						}
						setIsLoading(true);
						setError(null);
						let ignore = false;
						async function fetchItems() {
							try {
								const result = await params.fetchItems(searchValue);
								setSearchResults(result);
							} catch {
								if (!ignore) {
									setError(
										params.fetchFailedErrorMessage ??
											"Failed to fetch items. Please try again.",
									);
									setSearchResults([]);
								}
							} finally {
								if (!ignore) {
									setIsLoading(false);
								}
							}
						}
						const timeoutId = setTimeout(fetchItems, 300);
						return () => {
							clearTimeout(timeoutId);
							ignore = true;
						};
					}, [
						searchValue,
						params.fetchFailedErrorMessage,
						params.fetchItems,
						params,
					]);
					let status: React.ReactNode = "";
					if (isLoading) {
						status = (
							<div className="flex items-center gap-2">
								<LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
								Searching items...
							</div>
						);
					} else if (error) {
						status = error;
					} else if (searchResults.length === 0 && searchValue) {
						status =
							params.noItemsErrorMessage ??
							`No items found for "${searchValue}"`;
					} else if (searchResults.length > 0) {
						status = `${searchResults.length} item${searchResults.length === 1 ? "" : "s"} found`;
					} else if (!searchValue) {
						status =
							params.emptySearchErrorMessage ??
							"Start typing to search items...";
					}

					return (
						<Autocomplete
							mode={"inline"}
							openOnInputClick
							items={searchResults}
							value={searchValue}
							onValueChange={(value, event) => {
								if (event.reason === "item-press") {
									field.onChange(lastValue.current as TItem);
								}

								setSearchValue(value);
							}}
							itemToStringValue={(item: unknown) => {
								lastValue.current = item as TItem;
								return params.itemToStringValue(item as TItem);
							}}
							filter={null}
						>
							<Label className="flex flex-col gap-2">
								<span className="text-sm font-medium">Search subjects</span>
								<AutocompleteControl>
									<AutocompleteInput
										variant={"lg"}
										placeholder={params.placeholder}
									/>
									{searchValue && <AutocompleteClear />}
								</AutocompleteControl>
							</Label>
							<AutocompleteContent>
								<AutocompleteStatus>{status}</AutocompleteStatus>
								<AutocompleteList>
									{(item: TItem) => (
										<AutocompleteItem
											key={params.itemToKeyValue(item)}
											value={item}
											className="rounded-lg"
										>
											<params.ListItemComponent item={item} />
										</AutocompleteItem>
									)}
								</AutocompleteList>
							</AutocompleteContent>
						</Autocomplete>
					);
				}}
			/>
		);
	};
