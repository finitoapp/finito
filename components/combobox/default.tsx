import {
	CheckIcon,
	ChevronDown,
	PencilIcon,
	PlusIcon,
	XIcon,
} from "lucide-react";
import * as React from "react";
import { useMemo, useState } from "react";
import type { JsonValue } from "type-fest";
import { Overlay } from "@/components/overlay";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/shared/ui/cn";

const defaultCompare = <TItem extends JsonValue>(
	a: TItem | null,
	b: TItem | null,
) => {
	return JSON.stringify(a) === JSON.stringify(b);
};

export type EditComponentProps<
	TOutput extends JsonValue,
	TInput extends JsonValue = TOutput,
> = {
	defaultValue: TInput | undefined;
	close: () => unknown;
	save: (value: TOutput) => unknown;
};

const DefaultEdit = (props: EditComponentProps<string>) => {
	const [value, setValue] = useState(() => props.defaultValue ?? "");

	return (
		<Overlay isOpen={true} onClose={props.close}>
			<div className={"flex items-center gap-2 w-full"}>
				<Input
					placeholder="Enter custom value..."
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							props.save(value);
						} else if (e.key === "Escape") {
							props.close();
						}
					}}
					autoFocus
					className="flex-1"
				/>
				<Button size="icon" onClick={() => props.save(value)}>
					<CheckIcon className="h-4 w-4" />
				</Button>
				<Button size="icon" variant="outline" onClick={props.close}>
					<XIcon className="h-4 w-4" />
				</Button>
			</div>
		</Overlay>
	);
};

export type ComboboxDefaultProps<TItem extends JsonValue> = {
	placeholder?: string;
	items: {
		value: TItem;
		label: string;
	}[];
	value: TItem | null;
	onChange?: (value: TItem | null) => unknown;
	enableEdit?: boolean;
	enableAdd?: boolean;
	// formatCustomValue?: (value: TItem) => string;
	compareFunction?: (a: TItem | null, b: TItem | null) => boolean;
	EditComponent?: React.FC<EditComponentProps<TItem>>;
} & (TItem extends string
	? {
			formatCustomValue?: (value: TItem) => string;
		}
	: {
			formatCustomValue: (value: TItem) => string;
		});

export const ComboboxDefault = <TItem extends JsonValue>(
	props: ComboboxDefaultProps<TItem>,
) => {
	const [open, setOpen] = React.useState(false);
	const [editMode, setEditMode] = React.useState(false);
	const [editDefaultValue, setEditDefaultValue] = React.useState<
		TItem | undefined
	>(undefined);

	const handleAddCustomValue = (values: TItem) => {
		if (values === false) {
			return;
		}

		props.onChange?.(values);
		setEditMode(false);
	};

	const itemsMap = useMemo(
		() =>
			(props.items ?? []).reduce((acc, item) => {
				acc.set(item.value, item.label);
				return acc;
			}, new Map()),
		[props.items],
	);

	const EditComponent = props.EditComponent ?? DefaultEdit;

	if (editMode !== false && EditComponent === DefaultEdit) {
		return (
			<EditComponent
				// @ts-expect-error
				defaultValue={editDefaultValue}
				close={() => {
					setEditMode(false);
				}}
				// @ts-expect-error
				save={handleAddCustomValue}
			/>
		);
	}

	const compareFunction = props.compareFunction ?? defaultCompare;

	const allItems = [
		...(props.value !== undefined &&
		props.value !== null &&
		!itemsMap.has(props.value)
			? [
					{
						value: props.value,
						label:
							props.value !== null && props.formatCustomValue
								? // @ts-expect-error
									props.formatCustomValue(props.value)
								: props.value,
					},
				]
			: []),
		...(props.items ?? []),
	];

	return (
		<>
			{editMode !== false && (
				<EditComponent
					// @ts-expect-error
					defaultValue={editDefaultValue}
					close={() => {
						setEditMode(false);
					}}
					// @ts-expect-error
					save={handleAddCustomValue}
				/>
			)}
			<Popover open={open} onOpenChange={setOpen}>
				<div className={"flex w-full gap-2 items-center"}>
					<div className="relative w-full">
						<PopoverTrigger
							render={
								<Button
									variant="outline"
									role="combobox"
									aria-expanded={open}
									className="w-full"
								/>
							}
						>
							<span className={cn("truncate")}>
								{/*
// @ts-expect-error */}
								{props.value
									? allItems.find((item) =>
											compareFunction(item.value, props.value),
										)?.label
									: (props.placeholder ?? "")}
							</span>
							<ChevronDown
								data-slot="button-arrow"
								className={cn("ms-auto -me-1")}
							/>
						</PopoverTrigger>
						<div className={"absolute right-8 top-1/2 flex gap-2"}>
							{props.enableEdit && props.value && (
								<Button
									type={"button"}
									variant="ghost"
									size="icon"
									className="-translate-y-1/2 h-6 w-6 hover:bg-transparent"
									onClick={(e) => {
										e.stopPropagation();
										setEditMode(true);
										setEditDefaultValue(props.value ?? undefined);
									}}
								>
									<PencilIcon className="h-4 w-4 opacity-50 hover:opacity-100" />
								</Button>
							)}
							{props.value && (
								<Button
									variant="ghost"
									size="icon"
									className="-translate-y-1/2 h-6 w-6 hover:bg-transparent"
									onClick={(e) => {
										e.stopPropagation();
										if (props.onChange) {
											props.onChange(null);
										}
									}}
								>
									<XIcon className="h-4 w-4 opacity-50 hover:opacity-100" />
								</Button>
							)}
						</div>
					</div>
					{props.enableAdd && (
						<Button
							type={"button"}
							variant="secondary"
							className="raius-full"
							size={"sm"}
							title={"Add item"}
							onClick={(e) => {
								e.stopPropagation();
								setEditMode(true);
								setEditDefaultValue(undefined);
							}}
						>
							<PlusIcon className="size-4" aria-hidden="true" />
						</Button>
					)}
				</div>
				<PopoverContent className="w-(--radix-popper-anchor-width) p-0">
					<Command>
						<CommandInput placeholder="Search item..." />
						<CommandList>
							<ScrollArea className="max-h-[300px] [&>div]:block!">
								<CommandEmpty>No item found.</CommandEmpty>
								<CommandGroup>
									{allItems.map((item, index) => (
										<CommandItem
											key={index.toString()}
											value={index.toString()}
											onSelect={() => {
												console.log("onSelect", allItems[index]);

												if (props.onChange) {
													props.onChange(allItems[index].value);
												}
												setOpen(false);
											}}
										>
											{/*
// @ts-expect-error */}
											<span className="truncate">{item.label}</span>
											{compareFunction(props.value, item.value) && (
												<CheckIcon
													data-slot="command-check"
													data-check="true"
													className={cn("size-4 ms-auto text-primary")}
												/>
											)}
										</CommandItem>
									))}
								</CommandGroup>
							</ScrollArea>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</>
	);
};
