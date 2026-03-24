import { Check, Pencil, X } from "lucide-react";
import type { MouseEventHandler } from "react";
import * as React from "react";
import { toast } from "sonner";
import type { InlineEditPlugin } from "@/components/inline-edit/inline-edit-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared/ui/cn";

export type InlineEditProps<TRaw, TOut = TRaw> = {
	/** Field label shown above the value */
	label?: string;
	/** Current value */
	value: TRaw;
	/** Plugin — carries both the schema and the render function */
	PluginComponent: InlineEditPlugin<TRaw, TOut>;
	/**
	 * Called with the validated (and schema-inferred) value when user confirms.
	 * The type of `value` here is TOut — correctly narrowed by the plugin.
	 */
	onSave: (value: TOut) => void | Promise<void>;
	/** Custom renderer for the read-mode value. */
	renderValue?: (value: TRaw) => React.ReactNode;
	/** Extra class for the wrapper */
	className?: string;
	/** Disable editing */
	disabled?: boolean;
};

export function InlineEdit<TRaw, TOut = TRaw>({
	label,
	value,
	PluginComponent,
	onSave,
	renderValue,
	className,
	disabled = false,
}: InlineEditProps<TRaw, TOut>) {
	const [editing, setEditing] = React.useState(false);
	const [saving, setSaving] = React.useState(false);
	const [callback, setCallback] = React.useState<() => undefined | TOut>(
		() => () => undefined,
	);
	const id = React.useId();

	const startEdit: MouseEventHandler = (e) => {
		e.stopPropagation();
		if (disabled) return;
		setEditing(true);
	};

	const discard = () => {
		setEditing(false);
	};

	const save = async (value: TOut) => {
		setSaving(true);
		try {
			await onSave(value);
			setEditing(false);
		} finally {
			setSaving(false);
		}
	};

	const commit = async () => {
		const result = callback();
		if (result !== undefined) {
			await save(result);
			toast.success("Value has been saved.");
		}
	};

	const displayValue = renderValue
		? renderValue(value)
		: typeof value === "boolean"
			? value
				? "Ano"
				: "Ne"
			: String(value ?? "—");

	return (
		<div className={cn("group/ie relative", className)}>
			{label && (
				<div className="flex items-center gap-1.5 mb-0.5 min-h-8">
					<label
						htmlFor={id}
						className="text-muted-foreground tracking-wide select-none"
					>
						{label}
					</label>
				</div>
			)}

			{/* Value / Input area */}
			<div className={"flex gap-2"}>
				<button
					type={"button"}
					className={cn(
						"rounded-md transition-colors flex gap-2 w-full text-left",
						!editing &&
							!disabled &&
							"cursor-pointer hover:bg-accent/60 active:bg-accent",
						!editing && disabled && "cursor-default opacity-60",
					)}
					onClick={!editing ? startEdit : undefined}
					role={!editing && !disabled ? "button" : undefined}
					aria-label={!editing && !disabled ? `Upravit ${label}` : undefined}
				>
					{editing ? (
						<PluginComponent
							defaultValue={value}
							onSave={commit}
							onExit={() => setEditing(false)}
							registerOnSave={(callback) => {
								setCallback(() => callback);
								return () => setCallback(() => () => undefined);
							}}
							id={id}
						/>
					) : typeof displayValue === "string" ? (
						<button
							type={"button"}
							tabIndex={0}
							className={
								"w-full h-9 px-2.5 py-2 rounded-md border border-transparent text-left"
							}
							onKeyDown={() => {
								setEditing(true);
							}}
						>
							{displayValue}
						</button>
					) : (
						displayValue
					)}
				</button>

				<div className="flex items-center gap-1 ml-auto">
					{!editing && !disabled && (
						<Button
							variant="outline"
							aria-label={`Upravit ${label}`}
							onClick={startEdit}
							className="h-8 w-8"
						>
							<Pencil className="h-4 w-4" />
						</Button>
					)}

					{editing && (
						<>
							<Button
								aria-label="Uložit změnu"
								disabled={saving}
								onClick={commit}
								className="h-8 w-8"
							>
								<Check className="h-4 w-4" />
							</Button>
							<Button
								variant={"destructive"}
								aria-label="Zahodit změnu"
								disabled={saving}
								onClick={discard}
								className="h-8 w-8"
							>
								<X className="h-4 w-4" />
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
