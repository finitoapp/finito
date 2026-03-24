import type { ReactNode } from "react";

export function FieldRow(props: {
	label?: string;
	value: ReactNode;
	isEmpty?: (value: unknown) => boolean;
	emptyLabel?: string;
	action?: ReactNode;
}) {
	const isEmpty = (props.isEmpty ?? ((value) => value === null))(props.value);

	return (
		<div className="flex items-start justify-between gap-4 py-3">
			<div className="min-w-0 flex-1">
				<div className="text-sm text-muted-foreground">{props.label}</div>

				<div
					className={
						isEmpty
							? "mt-1 text-muted-foreground italic"
							: "mt-1 text-foreground"
					}
				>
					{isEmpty ? (props.emptyLabel ?? "-") : props.value}
				</div>
			</div>

			{props.action}
		</div>
	);
}
