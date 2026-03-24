import type React from "react";

/**
 * A plugin carries both the schema and the render function.
 * TRaw  = the value type the control works with internally (e.g. string for inputs)
 * TOut  = the validated/inferred output type (e.g. "admin" | "editor" for a select)
 */
export type InlineEditPlugin<TRaw, TOut = TRaw> = React.FC<{
	defaultValue: TRaw;
	id: string;
	onSave: (value: TOut) => void; // notify
	onExit: () => void; // notify
	registerOnSave: (callback: () => TOut | undefined) => () => void;
}>;
