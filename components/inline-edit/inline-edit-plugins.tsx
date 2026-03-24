"use client";

import type { Nullable } from "kysely";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IsNever } from "type-fest";
import { z } from "zod";
import type { $ZodIssueBase } from "zod/v4/core";
import type { InlineEditPlugin } from "@/components/inline-edit/inline-edit-types";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	NonEmptyString255Schema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

export function textPlugin<
	// biome-ignore lint/suspicious/noExplicitAny: It's OK here
	TSchema extends z.ZodType<any, string> = never,
>(props: {
	inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
	schema?: TSchema;
}): InlineEditPlugin<
	string | null,
	IsNever<TSchema> extends true ? string : z.output<TSchema>
> {
	return ({ defaultValue, registerOnSave, onSave, onExit, id }) => {
		const ref = useRef<HTMLInputElement>(null);
		const [errors, setErrors] = useState<$ZodIssueBase[] | null>(null);

		const save = useCallback(() => {
			if (props.schema === undefined)
				return (ref.current?.value ?? "") as IsNever<TSchema> extends true
					? string
					: z.output<TSchema>;

			const result = props.schema.safeParse(ref.current?.value ?? "");
			if (result.success) {
				setErrors(null);
				return result.data as IsNever<TSchema> extends true
					? string
					: z.output<TSchema>;
			}

			setErrors(result.error.issues);

			return undefined;
		}, []);

		useEffect(() => registerOnSave(save), [registerOnSave, save]);

		return (
			<Field data-invalid={errors}>
				<Input
					ref={ref}
					id={id}
					type="text"
					defaultValue={defaultValue ?? ""}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							onExit();
							return;
						}

						if (e.key === "Enter") {
							const result = save();
							if (result === undefined) return;

							onSave(result);
						}
					}}
					autoFocus
					{...props.inputProps}
				/>
				{errors && <FieldError errors={errors} />}
			</Field>
		);
	};
}

export const nonEmptyString255Plugin = textPlugin({
	schema: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
});

export const nonEmptyNullableString255Plugin = textPlugin({
	schema: StringToNullableStringSchema.pipe(NonEmptyString255Schema.nullable()),
});

/**
 * selectPlugin — output type is inferred as a union of the option values.
 * No external schema needed: the plugin builds it from the provided options.
 */
export type SelectOption<T extends string = string> = Record<T, string>;

export function selectPlugin<
	const T extends string,
	const TAllowNull extends boolean,
>(params: {
	options: SelectOption<T>;
	emptyTitle?: string;
	show?: TAllowNull;
	allowNull?: TAllowNull;
}): InlineEditPlugin<T | null, TAllowNull extends true ? Nullable<T> : T> {
	const schema = params.allowNull
		? z.enum(Object.keys(params.options)).nullable()
		: z.enum(Object.keys(params.options));

	return ({ defaultValue, registerOnSave, id, onExit }) => {
		const valueRef = useRef<string | null>(defaultValue);
		const [errors, setErrors] = useState<$ZodIssueBase[] | null>(null);

		const save = useCallback(() => {
			if (schema === undefined) return valueRef.current as T;

			const result = schema.safeParse(valueRef.current);
			if (result.success) {
				setErrors(null);
				return result.data as T;
			}

			setErrors(result.error.issues);

			return undefined;
		}, []);

		useEffect(() => registerOnSave(save), [registerOnSave, save]);

		return (
			<Field data-invalid={errors}>
				<Select
					id={id}
					defaultValue={defaultValue}
					onValueChange={(value) => {
						valueRef.current = value;
					}}
					items={params.options}
				>
					<SelectTrigger
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								onExit();
								return;
							}
						}}
					>
						<SelectValue placeholder={params.emptyTitle} />
					</SelectTrigger>
					<SelectContent
						alignItemWithTrigger
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								onExit();
								return;
							}
						}}
					>
						{(params.allowNull || valueRef.current === null) && (
							<SelectItem value={null}>&nbsp;</SelectItem>
						)}
						{Object.entries(params.options).map(([key, value]) => (
							<SelectItem key={key} value={key}>
								{value as string}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{errors && <FieldError errors={errors} />}
			</Field>
		);
	};
}

export function checkboxPlugin(): InlineEditPlugin<boolean, boolean> {
	return ({ defaultValue, id, registerOnSave, onExit, onSave }) => {
		const ref = useRef<HTMLInputElement>(null);

		const save = useCallback(() => {
			return ref.current?.checked ?? false;
		}, []);

		useEffect(() => registerOnSave(save), [registerOnSave, save]);

		return (
			<Field>
				<Checkbox
					id={id}
					defaultChecked={defaultValue}
					inputRef={ref}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							onExit();
							return;
						}

						if (e.key === "Enter") {
							const result = save();
							if (result === undefined) return;

							onSave(result);
						}
					}}
					autoFocus
				/>
			</Field>
		);
	};
}
