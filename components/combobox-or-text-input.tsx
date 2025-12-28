import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import type { JsonValue } from "type-fest";
import type { AutoFormComponent } from "@/components/auto-form";
import {
	ComboboxDefault,
	type ComboboxDefaultProps,
} from "@/components/combobox/default";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";

export const createComboboxOrTextInput =
	<TItem extends JsonValue>(
		params: {
			fetchItems: () => Promise<ComboboxDefaultProps<TItem>["items"]>;
		} & Omit<ComboboxDefaultProps<TItem>, "items" | "value" | "onChange"> & {
				label?: string;
				description?: string;
			},
	): AutoFormComponent<TItem> =>
	(props) => {
		const id = useId();
		const { data } = useQuery({
			queryKey: [`combobox-input-${id}`],
			queryFn: params.fetchItems,
			staleTime: 0,
			gcTime: 0,
		});

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
							<div className="flex flex-col gap-2">
								<FormControl>
									{/*
// @ts-expect-error */}
									<ComboboxDefault
										{...field}
										{...params}
										items={data ?? []}
										enableEdit={true}
									/>
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
