"use client";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconPencil } from "@tabler/icons-react";
import { format } from "date-fns";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CalendarIcon,
	CircleXIcon,
	GripVerticalIcon,
	Loader2,
	PlusCircleIcon,
	Save,
	XIcon,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
	type Control,
	useFieldArray,
	useFormContext,
	useWatch,
} from "react-hook-form";
import type {
	ConditionalPick,
	Get,
	Paths,
	Simplify,
	UnionToIntersection,
} from "type-fest";
import type { z } from "zod";
import { CollapsibleSeparator } from "@/components/collapsible-separator";
import { CopyButton } from "@/components/copy-button";
import { PasswordInput } from "@/components/password-input";
import { PasswordTextarea } from "@/components/password-textarea";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input, InputAddon, InputGroup } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { UseActionFormResult } from "@/hooks/use-action-form";
import { useMediaQuery } from "@/hooks/use-media-query";
import { currencyConverter } from "@/lib/currency-converter/currency-converter";
import { shiftNumericString } from "@/lib/number-utils";
import { Currency, NumberStringSchema } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AutoFormComponents<TSchema extends Record<string, unknown>> = {
	[key in keyof TSchema]-?: AutoFormComponent<TSchema[key]>;
};

export type AutoFormBaseSchema =
	| z.ZodObject
	| z.ZodUnion<readonly (z.ZodObject | z.ZodUnion<readonly z.ZodObject[]>)[]>;

const AutoFormInputLayer = <
	S extends AutoFormBaseSchema,
	TComponents extends AutoFormComponents<z.input<S>>,
>(props: {
	components: TComponents;
	control: Control<z.input<S>, unknown, z.output<S>>;
}) => {
	return (
		<>
			{Object.entries(props.components).map(([key, Component]) => (
				<Component key={key} name={key} control={props.control} />
			))}
		</>
	);
};
export const AutoForm = <
	S extends AutoFormBaseSchema,
	TComponents extends AutoFormComponents<z.input<S>>,
>(props: {
	form: UseActionFormResult<S>;
	components: TComponents;
	saveClassName?: React.ComponentProps<"div">["className"];
	saveLabel?: React.ReactNode;
}) => {
	console.log(props.form.form.formState);

	return (
		<Form {...props.form.form}>
			<form
				onSubmit={(e) => {
					e.stopPropagation(); // Prevent bubbling to parent form
					props.form.handleSubmitWithAction(e);
				}}
				className={"gap-4 flex flex-col space-y-4"}
			>
				<AutoFormInputLayer
					components={props.components}
					control={props.form.form.control}
				/>

				<div className="flex justify-end gap-4">
					<Button
						type="submit"
						className={props.saveClassName}
						disabled={
							props.form.form.formState.isSubmitting ||
							props.form.form.formState.disabled
						}
					>
						{props.form.form.formState.isSubmitting && (
							<Loader2 className="animate-spin" />
						)}
						{props.saveLabel ?? (
							<>
								<Save /> Save
							</>
						)}
					</Button>
				</div>
			</form>
		</Form>
	);
};

export type AutoFormComponent<TType> = React.FC<{
	$type: TType;
	control: Control;
	name: string;
}>;

type InputParams = {
	label?: string;
	description?: string;
	placeholder?: string;
	type?: React.HTMLInputTypeAttribute;
	disabled?: boolean;
	copyToClipboard?: boolean;
	secretContent?: boolean;
};

type CheckboxParams = {
	label?: string;
	description?: string;
	disabled?: boolean;
};

type CreateComponentResult<
	TName extends string,
	// biome-ignore lint/suspicious/noExplicitAny: don't be shy to improve it
	TComponent extends AutoFormComponent<any>,
> = Record<TName, TComponent>;

const createComponent = <
	const TName extends string,
	// biome-ignore lint/suspicious/noExplicitAny: don't be shy to improve it
	TComponent extends AutoFormComponent<any>,
>(
	name: TName,
	component: TComponent,
): CreateComponentResult<TName, TComponent> =>
	({
		[name]: component,
	}) as CreateComponentResult<TName, TComponent>;

export const AutoFormInput = {
	text:
		(
			params: InputParams & {
				startAddon?: React.ReactNode;
				endAddon?: React.ReactNode;
			},
		): AutoFormComponent<string | undefined> =>
		(props) => (
			<FormField
				control={props.control}
				name={props.name}
				render={({ field }) => (
					<FormItem>
						{params.label && (
							<FormLabel htmlFor={field.name}>{params.label}</FormLabel>
						)}
						<div className="flex gap-2">
							<FormControl>
								<InputGroup className={"w-full"}>
									{params.startAddon && (
										<InputAddon>{params.startAddon}</InputAddon>
									)}
									{params.secretContent ? (
										<PasswordInput
											{...field}
											disabled={params.disabled}
											placeholder={params.placeholder}
										/>
									) : (
										<Input
											{...field}
											disabled={params.disabled}
											type={params.type}
											placeholder={params.placeholder}
										/>
									)}
									{params.endAddon && (
										<InputAddon>{params.endAddon}</InputAddon>
									)}
								</InputGroup>
							</FormControl>
							{params.copyToClipboard && (
								<CopyButton type={"button"} text={field.value} />
							)}
						</div>
						{params.description && (
							<FormDescription>{params.description}</FormDescription>
						)}
						<FormMessage />
					</FormItem>
				)}
			/>
		),
	amount: (
		params: InputParams & {
			computeAmount?:
				| {
						sourceAmountFieldName: string;
						sourceCurrencyFieldName: string;
				  }
				| undefined;
		} & (
				| {
						currencyFieldName: string;
				  }
				| {
						currency: Currency;
				  }
			),
	): AutoFormComponent<string | undefined> => {
		return (props) => {
			const useCurrency =
				"currency" in params
					? () => params.currency
					: () =>
							useWatch({
								control: props.control,
								name: params.currencyFieldName,
							});

			const useComputedAmount = params.computeAmount
				? ({
						targetCurrency,
						onChange,
					}: {
						targetCurrency: Currency;
						onChange: (value: string) => unknown;
					}) => {
						const [amount, currency] = useWatch({
							control: props.control,
							name: [
								// @ts-expect-error
								params.computeAmount.sourceAmountFieldName,
								// @ts-expect-error
								params.computeAmount.sourceCurrencyFieldName,
							],
						});

						useEffect(() => {
							(async () => {
								if (currency === null || targetCurrency === null) {
									return;
								}

								const newAmount = await currencyConverter.convert({
									amount: amount,
									sourceCurrency: currency,
									targetCurrency,
								});

								if (newAmount !== null) {
									onChange(newAmount.toString());
								}
							})();
						}, [onChange, targetCurrency, amount, currency]);
					}
				: () => null;

			return (
				<FormField
					control={props.control}
					name={props.name}
					render={({ field }) => {
						const currencyValue = useCurrency();
						useComputedAmount({
							targetCurrency: currencyValue,
							onChange: field.onChange,
						});
						const value = NumberStringSchema.safeParse(field.value);

						return (
							<FormItem>
								{params.label && (
									<FormLabel htmlFor={field.name}>{params.label}</FormLabel>
								)}
								<div className="flex gap-2">
									<FormControl>
										<InputGroup className={"w-full"}>
											<Input
												{...field}
												disabled={params.disabled}
												type={params.type}
												placeholder={params.placeholder}
												value={
													currencyValue === Currency.BTC && value.success
														? shiftNumericString(value.data, 8)
														: field.value
												}
												onChange={(e) => {
													if (currencyValue === Currency.BTC) {
														const value = NumberStringSchema.safeParse(
															e.target.value,
														);

														return field.onChange({
															...e,
															target: {
																...e.target,
																value: value.success
																	? shiftNumericString(value.data, -8)
																	: e.target.value,
															},
														});
													}

													return field.onChange(e);
												}}
											/>
											{currencyValue === Currency.BTC && (
												<InputAddon>Sats</InputAddon>
											)}
										</InputGroup>
									</FormControl>
									{params.copyToClipboard && (
										<CopyButton type={"button"} text={field.value} />
									)}
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
	},
	date:
		(params: InputParams): AutoFormComponent<Date | null> =>
		(props) => (
			<FormField
				control={props.control}
				name={props.name}
				render={({ field }) => (
					<FormItem>
						{params.label && (
							<FormLabel htmlFor={field.name}>{params.label}</FormLabel>
						)}
						<FormControl>
							<Popover>
								<PopoverTrigger asChild>
									<div className="relative">
										<Button
											type="button"
											variant={"outline"}
											mode="input"
											className="w-full"
										>
											<CalendarIcon />
											{field.value ? (
												format(field.value, "PPP")
											) : (
												<span>Pick a date</span>
											)}
										</Button>
										{field.value && (
											<Button
												type="button"
												variant="dim"
												size="sm"
												className="absolute top-1/2 -end-0 -translate-y-1/2"
												onClick={(e) => {
													e.preventDefault();
													field.onChange(null);
												}}
											>
												<XIcon />
											</Button>
										)}
									</div>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={field.value}
										onSelect={field.onChange}
										autoFocus
									/>
								</PopoverContent>
							</Popover>
						</FormControl>
						{params.description && (
							<FormDescription>{params.description}</FormDescription>
						)}
						<FormMessage />
					</FormItem>
				)}
			/>
		),
	checkbox:
		(params: CheckboxParams): AutoFormComponent<boolean> =>
		(props) => (
			<FormField
				control={props.control}
				name={props.name}
				render={({ field }) => (
					<FormItem>
						{params.label && (
							<FormLabel htmlFor={field.name}>{params.label}</FormLabel>
						)}
						<div className="flex gap-2">
							<FormControl>
								<Checkbox
									{...field}
									checked={field.value}
									onChange={undefined}
									onCheckedChange={(value) => field.onChange(value === true)}
									disabled={params.disabled}
								/>
							</FormControl>
						</div>
						{params.description && (
							<FormDescription>{params.description}</FormDescription>
						)}
						<FormMessage />
					</FormItem>
				)}
			/>
		),
	textarea:
		(
			params: InputParams & {
				rows?: number;
			},
		): AutoFormComponent<string | undefined> =>
		(props) => (
			<FormField
				control={props.control}
				name={props.name}
				render={({ field }) => (
					<FormItem>
						{params.label && (
							<FormLabel htmlFor={field.name}>{params.label}</FormLabel>
						)}
						<div className="flex gap-2">
							<FormControl>
								{params.secretContent ? (
									<PasswordTextarea
										rows={params.rows}
										{...field}
										placeholder={params.placeholder}
										disabled={params.disabled}
									/>
								) : (
									<Textarea
										rows={params.rows}
										{...field}
										placeholder={params.placeholder}
										disabled={params.disabled}
									/>
								)}
							</FormControl>
							{params.copyToClipboard && (
								<CopyButton type={"button"} text={field.value} />
							)}
						</div>
						{params.description && (
							<FormDescription>{params.description}</FormDescription>
						)}
						<FormMessage />
					</FormItem>
				)}
			/>
		),
	select:
		<const TValues extends Record<string, string>>(
			params: InputParams & {
				variant?: "select" | "toggle";
				allowEmpty: boolean;
				emptyTitle?: string;
				values: TValues | (() => Promise<TValues>);
			},
		): AutoFormComponent<keyof TValues | null> =>
		(props) => {
			const [values, setValues] = useState(
				typeof params.values !== "function" ? params.values : [],
			);

			useEffect(() => {
				if (typeof params.values !== "function") {
					return;
				}

				params.values().then((values) => {
					setValues(values);
				});
			}, [params.values, params]);

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

								{params.variant === "toggle" ? (
									<ToggleGroup
										type="single"
										variant="outline"
										className={"w-min"}
										value={field.value ?? ""}
										onValueChange={(value) => {
											if (!params.allowEmpty && value === "") {
												return;
											}

											field.onChange(value === "" ? null : value);
										}}
									>
										{Object.entries(values).map(([key, value]) => (
											<ToggleGroupItem key={key} value={key}>
												{value}
											</ToggleGroupItem>
										))}
									</ToggleGroup>
								) : (
									<Select
										{...field}
										value={field.value === null ? "_" : field.value}
										onValueChange={(value) =>
											field.onChange(value === "_" ? null : value)
										}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder={params.emptyTitle} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{params.allowEmpty && (
												<SelectItem value={"_"}>
													{params.emptyTitle ?? <>&nbsp;</>}
												</SelectItem>
											)}
											{Object.entries(values).map(([key, value]) => (
												<SelectItem key={key} value={key}>
													{value}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
								{params.description && (
									<FormDescription>{params.description}</FormDescription>
								)}
								<FormMessage />
							</FormItem>
						);
					}}
				/>
			);
		},
	// biome-ignore lint/suspicious/noExplicitAny: don't be shy to improve it
} as const satisfies Record<string, (params: any) => AutoFormComponent<any>>;

type SwitchTabsFieldProps<TSchema extends Record<string, unknown>> = {
	label: string;
	icon: React.ReactNode;
	components: Partial<AutoFormComponents<TSchema>>;
};

type CreateComponentResults<
	TName extends string,
	// biome-ignore lint/suspicious/noExplicitAny: don't be shy to improve it
	TComponents extends Record<string, (params: any) => AutoFormComponent<any>>,
> = {
	[key in keyof TComponents]: (
		params: Parameters<TComponents[key]>[0],
	) => CreateComponentResult<TName, ReturnType<TComponents[key]>>;
};

export type Builder<
	TSchema extends Record<string, unknown>,
	TRootSchema extends Record<string, unknown>,
> = {
	createComponent: <TName extends keyof TSchema & string>(
		name: TName,
		component: AutoFormComponent<Get<TSchema, TName>>,
	) => CreateComponentResult<TName, AutoFormComponent<Get<TRootSchema, TName>>>;
	magicInput: <TName extends keyof TSchema & string>(
		name: TName,
	) => CreateComponentResults<
		TName,
		// @ts-expect-error
		ConditionalPick<
			typeof AutoFormInput,
			// biome-ignore lint/suspicious/noExplicitAny: don't be shy to improve it
			(props: any) => AutoFormComponent<TSchema[TName]>
		>
	>;
	input: <TName extends keyof TSchema & string>(
		name: TName,
		component: AutoFormComponent<TSchema[TName]>,
	) => CreateComponentResult<TName, AutoFormComponent<TSchema[TName]>>;
	space: () => Record<never, unknown>;
	line: <TComponent extends Partial<AutoFormComponents<TSchema>>>(
		components: TComponent,
	) => TComponent;
	card: <TComponent extends Partial<AutoFormComponents<TSchema>>>(
		options: {
			title?: string;
			description?: string;
			variant?: "transparent";
		},
		components: TComponent,
	) => TComponent;
	collapsibleSeparator: <
		TComponent extends Partial<AutoFormComponents<TSchema>>,
	>(
		options: {
			title: string;
			watchErrors: (keyof TSchema & string)[];
		},
		components: TComponent,
	) => TComponent;
	accordion: <TComponent extends Partial<AutoFormComponents<TSchema>>>(
		options: {
			title?: string;
			InfoComponent?: React.FC<{ values: TSchema }>;
		},
		components: TComponent,
	) => TComponent;
	when: <
		TName extends Paths<TRootSchema>,
		TComponent extends Partial<AutoFormComponents<TSchema>>,
	>(
		name: TName,
		expectedValue:
			| Get<TRootSchema, TName>
			| ((value: Get<TRootSchema, TName>) => boolean),
		components: TComponent,
		elseComponents?: TComponent,
	) => TComponent;
	whenNot: <
		TName extends Paths<TRootSchema>,
		TComponent extends Partial<AutoFormComponents<TSchema>>,
	>(
		name: TName,
		expectedValue: Get<TRootSchema, TName>,
		components: TComponent,
	) => TComponent;
	tabs: <
		TName extends keyof TSchema & string,
		TFields extends Record<
			// @ts-expect-error
			TSchema[TName],
			SwitchTabsFieldProps<TSchema>
		>,
	>(
		name: TName,
		params: {
			fields: TFields;
		},
	) => Simplify<
		UnionToIntersection<
			Record<TName, AutoFormComponent<string | null | undefined>> &
				TFields[keyof TFields]["components"]
		>
	>;
	nestedField: <
		TName extends keyof ConditionalPick<TSchema, Record<string, unknown>> &
			string,
	>(
		name: TName,
		components: (params: {
			builder: Builder<
				// @ts-expect-error
				TSchema[TName],
				TRootSchema
			>;
		}) => AutoFormComponents<
			// @ts-expect-error
			TSchema[TName]
		>,
	) => CreateComponentResult<TName, AutoFormComponent<TSchema[TName]>>;
	arrayField: <
		TName extends keyof ConditionalPick<TSchema, unknown[]> & string,
	>(
		options: {
			name: TName;
			// @ts-expect-error
			defaultValue: TSchema[TName][number];
		},
		components: (params: {
			builder: Builder<
				// @ts-expect-error
				TSchema[TName][number],
				TRootSchema
			>;
		}) => AutoFormComponents<
			// @ts-expect-error
			TSchema[TName][number]
		>,
	) => CreateComponentResult<TName, AutoFormComponent<TSchema[TName]>>;
	arrayTableField: <
		TName extends keyof ConditionalPick<TSchema, unknown[]> & string,
	>(
		options: {
			name: TName;
			// @ts-expect-error
			defaultValue: TSchema[TName][number];
			columns: {
				title: string;
				className?: React.ComponentProps<"div">["className"];
				inputCellClassName?: React.ComponentProps<"div">["className"];
				hidden?: boolean;
			}[];
			addRowLabel?: string;
		},
		components: (params: {
			builder: Builder<
				// @ts-expect-error
				TSchema[TName][number],
				TRootSchema
			>;
		}) => AutoFormComponents<
			// @ts-expect-error
			TSchema[TName][number]
		>,
	) => CreateComponentResult<TName, AutoFormComponent<TSchema[TName]>>;
};

const createBuilder = <
	TSchema extends Record<string, unknown>,
	TRootSchema extends Record<string, unknown> = TSchema,
>(
	_schema: z.ZodSchema<unknown, TSchema>,
	prefix: string = "",
): Builder<TSchema, TRootSchema> => {
	let counter = 1;

	return {
		createComponent: (name, component) =>
			// @ts-expect-error
			createComponent(prefix + name, component),
		magicInput: (name) =>
			new Proxy(AutoFormInput, {
				get(target, prop) {
					// @ts-expect-error
					const origMethod = target[prop];
					if (typeof origMethod === "function") {
						return (...params: unknown[]) =>
							createComponent(prefix + name, origMethod(...params));
					}
				},
			}) as ReturnType<Builder<TSchema, TRootSchema>["magicInput"]>,
		input: (name, component) => createComponent(prefix + name, component),
		space: () =>
			createComponent(`_line_${prefix}${counter++}`, () => (
				<div>&nbsp;</div>
			)) as ReturnType<Builder<TSchema, TRootSchema>["space"]>,
		line: (components) =>
			// @ts-expect-error
			createComponent(`_line_${prefix}${counter++}`, (props) => (
				<div
					className={`grid grid-cols-${Object.keys(components).length} gap-4 max-lg:grid-cols-1`}
				>
					{Object.entries(components).map(([key, Component]) => (
						<Component key={key} name={key} control={props.control} />
					))}
				</div>
			)) as ReturnType<Builder<TSchema, TRootSchema>["line"]>,
		card: (options, components) =>
			// @ts-expect-error
			createComponent(`_line_${prefix}${counter++}`, (props) => (
				<Card
					className={`${options.variant === "transparent" ? "bg-transparent shadow-none border-0" : ""}`}
				>
					{(options.title || options.description) && (
						<CardHeader>
							{options.title && <CardTitle>{options.title}</CardTitle>}
							{options.description && (
								<CardDescription>{options.description}</CardDescription>
							)}
						</CardHeader>
					)}
					<CardContent
						className={`${options.variant === "transparent" ? "px-0" : ""}`}
					>
						<div className={`gap-4 flex flex-col`}>
							{Object.entries(components).map(([key, Component]) => (
								<Component key={key} name={key} control={props.control} />
							))}
						</div>
					</CardContent>
				</Card>
			)) as ReturnType<Builder<TSchema, TRootSchema>["card"]>,
		collapsibleSeparator: (options, components) =>
			// @ts-expect-error
			createComponent(`_line_${prefix}${counter++}`, (props) => {
				const { formState } = useFormContext();

				const forceOpen = options.watchErrors.find(
					(errorPath) => formState.errors[errorPath] !== undefined,
				);

				return (
					<CollapsibleSeparator
						title={options.title}
						forceOpen={forceOpen !== undefined}
					>
						<div className={`gap-4 flex flex-col`}>
							{Object.entries(components).map(([key, Component]) => (
								<Component key={key} name={key} control={props.control} />
							))}
						</div>
					</CollapsibleSeparator>
				);
			}) as ReturnType<Builder<TSchema, TRootSchema>["card"]>,
		accordion: (options, components) =>
			// @ts-expect-error
			createComponent(`_line_${prefix}${counter++}`, (props) => {
				const InfoComponent = (() => {
					const Component = options.InfoComponent;
					if (!Component) {
						return undefined;
					}

					return () => {
						const value = useWatch({
							control: props.control,
							// @ts-expect-error
							name: prefix !== "" ? prefix : undefined,
						});

						return (
							<Component
								// @ts-expect-error
								values={value}
							/>
						);
					};
				})();

				return (
					<Accordion type="single" collapsible>
						<AccordionItem value="item" className={"group"}>
							<AccordionTrigger>
								<span className="group-data-[state=closed]:hidden">
									{options.title}
								</span>
								<Button
									type={"button"}
									size={"sm"}
									variant={"outline"}
									className="group-data-[state=open]:hidden"
								>
									<IconPencil />
									{options.title}
								</Button>
							</AccordionTrigger>

							{InfoComponent && (
								<span className="group-data-[state=closed]:block group-data-[state=open]:hidden text-sm text-muted-foreground ml-2">
									<InfoComponent />
								</span>
							)}

							<AccordionContent>
								<div className={`gap-4 flex flex-col`}>
									{Object.entries(components).map(([key, Component]) => (
										<Component key={key} name={key} control={props.control} />
									))}
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				);
			}) as ReturnType<Builder<TSchema, TRootSchema>["card"]>,
		when: (name, expectedValue, components, elseComponents) =>
			// @ts-expect-error
			createComponent(`_line_${prefix}${counter++}`, (props) => {
				const value = useWatch({
					name,
					control: props.control,
				});

				const finalComponents = (() => {
					if (typeof expectedValue === "function") {
						// @ts-expect-error
						if (!expectedValue(value)) {
							return elseComponents ?? null;
						}
					} else if (value !== expectedValue) {
						return elseComponents ?? null;
					}

					return components;
				})();

				if (finalComponents === null) {
					return null;
				}

				return (
					<>
						{Object.entries(finalComponents).map(([key, Component]) => (
							<Component key={key} name={key} control={props.control} />
						))}
					</>
				);
			}) as ReturnType<Builder<TSchema, TRootSchema>["when"]>,
		whenNot: (name, expectedValue, components) =>
			// @ts-expect-error
			createComponent(`_line_${prefix}${counter++}`, (props) => {
				const value = useWatch({
					name,
					control: props.control,
				});
				if (value === expectedValue) {
					return null;
				}

				return (
					<>
						{Object.entries(components).map(([key, Component]) => (
							<Component key={key} name={key} control={props.control} />
						))}
					</>
				);
			}) as ReturnType<Builder<TSchema, TRootSchema>["whenNot"]>,
		nestedField: <
			TName extends keyof ConditionalPick<TSchema, Record<string, unknown>> &
				string,
		>(
			name: TName,
			callback: (params: {
				builder: Builder<
					// @ts-expect-error
					TSchema[TName],
					TRootSchema
				>;
			}) => AutoFormComponents<
				// @ts-expect-error
				TSchema[TName]
			>,
		) => {
			const builder = createBuilder<
				// @ts-expect-error
				TSchema[TName],
				TRootSchema
			>(_schema, `${prefix}${name}.`);

			return callback({ builder }) as unknown as CreateComponentResult<
				TName,
				AutoFormComponent<TSchema[TName]>
			>;
		},
		arrayField: <
			TName extends keyof ConditionalPick<TSchema, unknown[]> & string,
		>(
			options: {
				name: TName;
				// @ts-expect-error
				defaultValue: TSchema[TName][number];
			},
			callback: (params: {
				builder: Builder<
					// @ts-expect-error
					TSchema[TName][number],
					TRootSchema
				>;
			}) => AutoFormComponents<
				// @ts-expect-error
				TSchema[TName][number]
			>,
		) => {
			return createComponent(options.name, (props) => {
				const { fields, append, remove } = useFieldArray({
					control: props.control, // control props comes from useForm (optional: if you are using FormProvider)
					name: props.name, // unique name for your Field Array
				});

				return (
					<>
						{fields.map((field, index) => {
							const builder = createBuilder<
								// @ts-expect-error
								TSchema[TName][number],
								TRootSchema
							>(_schema, `${props.name}.${index}.`);
							const components = callback({ builder });

							return (
								<React.Fragment key={field.id}>
									<AutoFormInputLayer
										// @ts-expect-error
										components={components}
										control={props.control}
									/>
									<Button
										type={"button"}
										variant={"outline"}
										onClick={() => remove(index)}
									>
										Remove
									</Button>
								</React.Fragment>
							);
						})}
						<Button
							type={"button"}
							variant={"outline"}
							onClick={() => append(options.defaultValue)}
						>
							Add
						</Button>
					</>
				);
			}) as ReturnType<Builder<TSchema, TRootSchema>["arrayField"]>;
		},
		arrayTableField: <
			TName extends keyof ConditionalPick<TSchema, unknown[]> & string,
		>(
			options: {
				name: TName;
				// @ts-expect-error
				defaultValue: TSchema[TName][number];
				columns: {
					title: string;
					className?: React.ComponentProps<typeof TableHead>["className"];
					inputCellClassName?: React.ComponentProps<
						typeof TableHead
					>["className"];
					hidden?: boolean;
				}[];
				addRowLabel?: string;
			},
			callback: (params: {
				builder: Builder<
					// @ts-expect-error
					TSchema[TName][number],
					TRootSchema
				>;
			}) => AutoFormComponents<
				// @ts-expect-error
				TSchema[TName][number]
			>,
		) => {
			const RowComponent = (props: {
				index: number;
				name: string;
				control: Control;
				remove: (index: number) => void;
				move: (index: number, newIndex: number) => void;
				field: Record<"id", string>;
				columns: {
					title: string;
					className?: React.ComponentProps<typeof TableHead>["className"];
					inputCellClassName?: React.ComponentProps<
						typeof TableHead
					>["className"];
					hidden?: boolean;
				}[];
			}) => {
				const {
					attributes,
					listeners,
					setNodeRef,
					transform,
					transition,
					isDragging,
				} = useSortable({ id: props.field.id });

				const components = useMemo(() => {
					const builder = createBuilder<
						// @ts-expect-error
						TSchema[TName][number],
						TRootSchema
					>(_schema, `${props.name}.${props.index}.`);

					return callback({ builder });
				}, [props.name, props.index, _schema, callback]);

				const style = {
					transform: CSS.Transform.toString(transform),
					transition,
				};

				return (
					<TableRow
						key={props.field.id}
						// @ts-expect-error
						ref={setNodeRef}
						style={style}
						className={cn(
							isDragging ? "opacity-50" : "",
							"max-lg:grid max-lg:grid-cols-1 max-lg:gap-2",
							"[&>td]:p-1",
						)}
					>
						<TableCell className="max-lg:p-0">
							<Separator className={"lg:hidden"} />
							<div className="max-lg:p-0 max-lg:flex max-lg:gap-4 max-lg:my-2">
								<Button
									type={"button"}
									variant="outline"
									size="sm"
									className="h-8 w-8 p-0 cursor-grab active:cursor-grabbing max-lg:hidden"
									{...attributes}
									{...listeners}
								>
									<GripVerticalIcon className="h-4 w-4" />
									<span className="sr-only">Drag to reorder</span>
								</Button>

								<Button
									type={"button"}
									variant={"outline"}
									size="sm"
									className={"lg:hidden"}
									onClick={() => props.remove(props.index)}
								>
									<CircleXIcon />
									Remove item
								</Button>

								<Button
									type={"button"}
									variant="outline"
									size="sm"
									className={"lg:hidden"}
									onClick={() => props.move(props.index, props.index + 1)}
								>
									<ArrowDownIcon className="h-4 w-4" />
									Move down
								</Button>

								<Button
									disabled={props.index <= 0}
									type={"button"}
									variant="outline"
									size="sm"
									className={"lg:hidden"}
									onClick={() => props.move(props.index, props.index - 1)}
								>
									<ArrowUpIcon className="h-4 w-4" />
									Move up
								</Button>
							</div>
						</TableCell>
						{Object.entries(components)
							.filter(
								([key, Component], index) => !props.columns[index]?.hidden,
							)
							.map(([key, Component], index) => (
								<TableCell
									key={key}
									className={cn(
										"lg:[&>div>label]:hidden max-lg:p-0",
										props.columns[index]?.inputCellClassName,
									)}
								>
									{/* @ts-expect-error */}
									<Component name={key} control={props.control} />
								</TableCell>
							))}
						<TableCell className="w-12 max-lg:hidden">
							<Button
								type={"button"}
								variant={"outline"}
								onClick={() => props.remove(props.index)}
							>
								<CircleXIcon />
								<div className={"lg:hidden"}>Remove item</div>
							</Button>
						</TableCell>
					</TableRow>
				);
			};

			return createComponent(options.name, (props) => {
				const isMobile = useMediaQuery("(max-width: 1024px)");
				const { fields, append, remove, move } = useFieldArray({
					control: props.control, // control props comes from useForm (optional: if you are using FormProvider)
					name: props.name, // unique name for your Field Array
				});

				const sensors = useSensors(
					useSensor(PointerSensor),
					useSensor(KeyboardSensor, {
						coordinateGetter: sortableKeyboardCoordinates,
					}),
				);

				function handleDragEnd(event: DragEndEvent) {
					const { active, over } = event;

					if (over && active.id !== over.id) {
						const oldIndex = fields.findIndex((item) => item.id === active.id);
						const newIndex = fields.findIndex((item) => item.id === over.id);
						move(oldIndex, newIndex);
					}
				}

				return (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						{isMobile ? (
							<div className="flex flex-col gap-4">
								{fields.map((field, index) => (
									<RowComponent
										key={index.toString()}
										index={index}
										name={props.name}
										control={props.control}
										remove={remove}
										move={move}
										field={field}
										columns={options.columns}
									/>
								))}
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12"></TableHead>
										{options.columns
											.filter((column) => !column.hidden)
											.map((column, index) => (
												<TableHead
													className={column.className}
													key={index.toString()}
												>
													{column.title}
												</TableHead>
											))}
										<TableHead className="w-12"></TableHead>
									</TableRow>
								</TableHeader>

								<TableBody>
									<SortableContext
										items={fields}
										strategy={verticalListSortingStrategy}
									>
										{fields.map((field, index) => (
											<RowComponent
												key={index.toString()}
												index={index}
												name={props.name}
												control={props.control}
												remove={remove}
												move={move}
												field={field}
												columns={options.columns}
											/>
										))}
									</SortableContext>
								</TableBody>
							</Table>
						)}

						<div>
							<Button
								type={"button"}
								variant={"outline"}
								onClick={() => append(options.defaultValue)}
							>
								<PlusCircleIcon />
								{options.addRowLabel ?? "Add item"}
							</Button>
						</div>
					</DndContext>
				);
			}) as ReturnType<Builder<TSchema, TRootSchema>["arrayField"]>;
		},
	};
};

export const createAutoFormLayout = <TSchema extends AutoFormBaseSchema>(
	schema: TSchema,
	callback: (params: {
		builder: Builder<z.input<TSchema>, z.input<TSchema>>;
	}) => AutoFormComponents<z.input<TSchema>>,
): AutoFormComponents<z.input<TSchema>> => {
	return callback({
		// @ts-expect-error
		builder: createBuilder(schema) as Builder<
			z.input<TSchema>,
			z.input<TSchema>
		>,
	});
};
