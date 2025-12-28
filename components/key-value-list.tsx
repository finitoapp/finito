import { Lightbulb } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

interface KeyValueItem {
	key: string;
	value: string | number | React.ReactNode;
	help?: string;
	className?: string;
}

interface KeyValueListProps {
	items: KeyValueItem[];
	className?: string;
	orientation?: "horizontal" | "vertical";
	variant?: "default" | "bordered" | "card";
}

export function KeyValueList({
	items,
	className,
	orientation = "vertical",
	variant = "default",
}: KeyValueListProps) {
	const baseClasses = cn(
		"space-y-2",
		orientation === "horizontal" && "space-y-0 space-x-4 flex flex-wrap",
		variant === "bordered" && "border border-border rounded-lg p-4",
		variant === "card" &&
			"bg-card border border-border rounded-lg p-4 shadow-sm",
		className,
	);

	const itemClasses = cn(
		"grid grid-cols-[8rem_1fr_auto] gap-x-4 gap-y-1 items-start",
		orientation === "horizontal" && "flex flex-row items-center gap-2 min-w-0",
		"sm:grid sm:grid-cols-[8rem_1fr_auto] sm:gap-x-4 sm:gap-y-1 sm:items-start",
	);

	const keyClasses = cn(
		"text-sm font-medium text-muted-foreground text-right",
		orientation === "horizontal" && "whitespace-nowrap text-left",
	);

	const valueClasses = cn(
		"text-sm text-foreground break-words overflow-hidden",
		orientation === "horizontal" && "flex-1 min-w-0",
	);

	return (
		<div className={baseClasses}>
			{items.map((item, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: we don't have a better value
				<div key={index} className={cn(itemClasses, item.className)}>
					<span className={keyClasses}>{item.key}:</span>
					<span className={valueClasses}>{item.value}</span>
					<div className="flex items-center">
						{item.help && (
							<div className="group relative">
								<Lightbulb className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
								<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-popover border border-border rounded-md shadow-md text-sm text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
									{item.help}
									<div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border"></div>
								</div>
							</div>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
