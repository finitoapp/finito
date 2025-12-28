"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const loadingIndicatorVariants = cva(
	"inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm transition-all",
	{
		variants: {
			variant: {
				default: "",
				fullscreen: "fixed bg-background/80",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

interface LoadingIndicatorProps {
	text?: string | null;
	className?: string;
	open: boolean;
	status?: "loading" | "success" | "failure";
}

export function LoadingIndicator({
	text = "Loading...",
	className,
	variant,
	open,
	status = "loading",
}: LoadingIndicatorProps & VariantProps<typeof loadingIndicatorVariants>) {
	const [isVisible, setIsVisible] = useState(open);
	const [currentText, setCurrentText] = useState(text);
	const [isAnimating, setIsAnimating] = useState(false);

	useEffect(() => {
		if (text !== currentText) {
			setIsAnimating(true);
			const timeout = setTimeout(() => {
				setCurrentText(text);
				setIsAnimating(false);
			}, 300); // Half of the total animation duration

			return () => {
				clearTimeout(timeout);
			};
		}
	}, [text, currentText]);

	useEffect(() => {
		if (open && !isVisible) {
			setIsVisible(true);
			return;
		}

		if (!open && isVisible) {
			const timeout = setTimeout(() => {
				setIsVisible(false);
			}, 1000);
			return () => clearTimeout(timeout);
		}
	}, [open, isVisible]);

	if (!isVisible) {
		return null;
	}

	return (
		<div
			className={cn(
				loadingIndicatorVariants({ className, variant }),
				className,
				open ? "opacity-100" : "opacity-0",
			)}
		>
			{/* Spinning circle */}
			<div className="relative">
				{status === "success" && (
					<div className="h-28 w-28 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in-50 duration-300">
						<CheckIcon className={"size-12"} />
					</div>
				)}

				{status === "failure" && (
					<div className="h-28 w-28 rounded-full bg-red-700 flex items-center justify-center animate-in zoom-in-50 duration-300">
						<XIcon className={"size-12"} />
					</div>
				)}

				{status === "loading" && (
					<div className="h-28 w-28 animate-spin rounded-full border-8 border-muted border-t-primary" />
				)}
			</div>

			<div className="mt-6 relative h-8 w-full">
				<p
					className={cn(
						"absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-medium text-foreground transition-all duration-300 ease-in-out",
						isAnimating
							? "-translate-y-full opacity-0"
							: "translate-y-0 opacity-100",
					)}
				>
					{currentText}
				</p>
				{isAnimating && text !== null && (
					<p className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-medium text-foreground translate-y-full opacity-0 transition-all duration-300 ease-in-out delay-300 animate-[slideUp_0.3s_ease-in-out_0.3s_forwards]">
						{text}
					</p>
				)}
			</div>
		</div>
	);
}
