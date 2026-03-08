import type { Query, Row } from "@evolu/common";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { type DependencyList, useId } from "react";
import type { JsonValue } from "type-fest";
import type { AutoFormComponent } from "@/components/auto-form";
import { ComboboxDefault } from "@/components/combobox/default";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

type ComboboxItems<TItem extends JsonValue = JsonValue> = Array<{
	value: TItem;
	label: string;
}>;

type ComboboxParams = Omit<
	React.ComponentProps<typeof ComboboxDefault>,
	"items" | "value" | "onChange"
> & {
	label?: string;
	description?: string;
};

type ComboboxDataSource<TItem extends JsonValue> =
	| {
			fetchItems: () => Promise<ComboboxItems<TItem>>;
			items?: never;
	  }
	| {
			items: ComboboxItems<TItem>;
			fetchItems?: never;
	  };

export const createComboboxInput =
	<TItem extends JsonValue>(
		params: ComboboxDataSource<TItem> & ComboboxParams,
	): AutoFormComponent<TItem> =>
	(props) => {
		const id = useId();
		const { data } = useQuery({
			queryKey: [`combobox-input-${id}`],
			queryFn: async () => {
				if (typeof params.fetchItems === "function") {
					return await params.fetchItems();
				}
				return params.items;
			},
			enabled: "fetchItems" in params,
			staleTime: 0,
			gcTime: 0,
		});
		const items = "items" in params ? params.items : (data ?? []);

		return (
			<FormField
				control={props.control}
				name={props.name}
				render={({ field }) => {
					return (
						<FormItem>
							{params.label && (
								<FormLabel htmlFor={field.name}>{params.label}</FormLabel>
							)}
							<div className="flex gap-2">
								<FormControl>
									{/*
// @ts-expect-error */}
									<ComboboxDefault {...field} {...params} items={items} />
								</FormControl>
							</div>
							{params.description && (
								<FormDescription>{params.description}</FormDescription>
							)}
							<FormMessage />
						</FormItem>
					);
				}}
			/>
		);
	};

export const createEvoluComboboxInput =
	<TRow extends Row>(
		params: {
			query: Query<TRow>;
			queryDeps?: DependencyList;
			mapRowsToItems: (rows: readonly TRow[]) => ComboboxItems;
		} & ComboboxParams,
	): AutoFormComponent<JsonValue> =>
	(props) => {
		const { data: queryRows } = useEvoluQuery(params.query);
		const items = params.mapRowsToItems((queryRows ?? []) as TRow[]);

		return (
			<FormField
				control={props.control}
				name={props.name}
				render={({ field }) => {
					return (
						<FormItem>
							{params.label && (
								<FormLabel htmlFor={field.name}>{params.label}</FormLabel>
							)}
							<div className="flex gap-2">
								<FormControl>
									{/*
// @ts-expect-error */}
									<ComboboxDefault {...field} {...params} items={items} />
								</FormControl>
							</div>
							{params.description && (
								<FormDescription>{params.description}</FormDescription>
							)}
							<FormMessage />
						</FormItem>
					);
				}}
			/>
		);
	};
