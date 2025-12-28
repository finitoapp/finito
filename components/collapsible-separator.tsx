"use client";

import { ChevronDown } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollapsibleSeparatorProps {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
	forceOpen?: boolean;
}

export function CollapsibleSeparator({
	title,
	children,
	defaultOpen = false,
	forceOpen = false,
}: CollapsibleSeparatorProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	return (
		<div className="w-full">
			<div className="relative flex items-center">
				<div className="flex-1 border-t border-border" />
				<Button
					type={"button"}
					variant="outline"
					size="sm"
					onClick={() => setIsOpen(!isOpen)}
					className="mx-4 gap-2"
				>
					{title}
					<ChevronDown
						className={cn(
							"h-4 w-4 transition-transform duration-200",
							(isOpen || forceOpen) && "rotate-180",
						)}
					/>
				</Button>
				<div className="flex-1 border-t border-border" />
			</div>

			<div
				className={cn(
					"grid transition-all duration-200 ease-in-out",
					isOpen || forceOpen
						? "grid-rows-[1fr] opacity-100 pt-4"
						: "grid-rows-[0fr] opacity-0",
				)}
			>
				<div className="overflow-hidden">{children}</div>
			</div>
		</div>
	);
}
