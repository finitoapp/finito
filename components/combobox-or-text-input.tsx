import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { Controller } from "react-hook-form";
import type { JsonValue } from "type-fest";
import type { AutoFormComponent } from "@/components/auto-form";
import {
	ComboboxDefault,
	type ComboboxDefaultProps,
} from "@/components/combobox/default";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";

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
			<Controller
				control={props.control}
				name={props.name}
				render={({ field, fieldState }) => {
					return (
						<Field data-invalid={fieldState.invalid}>
							{params.label && (
								<FieldLabel htmlFor={field.name}>{params.label}</FieldLabel>
							)}
							<div className="flex flex-col gap-2">
								{/*
// @ts-expect-error */}
								<ComboboxDefault
									{...field}
									{...params}
									items={data ?? []}
									enableEdit={true}
								/>
							</div>
							{params.description && (
								<FieldDescription>{params.description}</FieldDescription>
							)}
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</Field>
					);
				}}
			/>
		);
	};
