"use client";

import type React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/shared/ui/cn";

interface ClickableCardProps {
	title: string;
	description: string;
	onClick: () => void;
	className?: string;
	children?: React.ReactNode;
}

export function ClickableCard({
	title,
	description,
	onClick,
	className,
	children,
	...props
}: ClickableCardProps & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<Card
			className={cn(
				"cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				"hover:bg-accent/50",
				className,
			)}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}}
			tabIndex={0}
			aria-label={`Click to select ${title}`}
			{...props}
		>
			{children && <CardContent>{children}</CardContent>}
			<CardHeader className={"flex items-center justify-center"}>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className={"text-muted-foreground text-sm"}>{description}</p>
			</CardContent>
		</Card>
	);
}
