"use client";

import { motion } from "framer-motion";
import { Check, Minus, Plus } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/shared/ui/cn";

interface CounterCheckboxProps {
	value: number;
	onCountChange: (count: number) => void;
	minCount: number;
	maxCount: number;
	className?: string;
	disabled?: boolean;
	children: React.ReactNode;
}

export function CounterCheckbox({
	value: controlledCount,
	onCountChange,
	minCount,
	maxCount,
	className,
	disabled,
	children,
}: CounterCheckboxProps) {
	const { t } = useTranslation();
	const handleCountChange = (newCount: number) => {
		const clampedCount = Math.max(minCount, Math.min(maxCount, newCount));
		onCountChange(clampedCount);
	};

	const select = () => {
		if (disabled) {
			return;
		}

		onCountChange(controlledCount < maxCount ? maxCount : 0);
	};

	const increment = () => {
		if (disabled) {
			return;
		}

		if (controlledCount < maxCount) {
			handleCountChange(controlledCount + 1);
		}
	};

	const decrement = () => {
		if (disabled) {
			return;
		}

		if (controlledCount > minCount) {
			handleCountChange(controlledCount - 1);
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: we need to use role=button to prevent button in button error
		<div
			tabIndex={0}
			className={cn("w-full flex items-center gap-4", className)}
			role={"button"}
			onClick={select}
			onKeyUp={select}
			data-state={controlledCount > 0 ? "on" : "off"}
		>
			<motion.div
				key={controlledCount}
				initial={{ scale: 1.1, opacity: 0.5 }}
				animate={{ scale: 1, opacity: 1 }}
				className="relative h-8 w-8"
			>
				<Checkbox
					// @ts-expect-error
					checked={
						maxCount > 1 && controlledCount > 0
							? "hidden"
							: controlledCount === 1
					}
					onCheckedChange={select}
					disabled={disabled}
					className="h-8 w-8 border-3"
				/>
				{maxCount === 1 && (
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<Check className="h-4 w-4 text-primary-foreground" />
					</div>
				)}
				{maxCount > 1 && (
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<span className="text-md font-bold text-primary-foreground">
							{controlledCount}
						</span>
					</div>
				)}
			</motion.div>

			<div className={"flex-1"}>{children}</div>

			{controlledCount > 0 && maxCount > 1 && (
				<ButtonGroup>
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="h-10 w-10 rounded-r-none"
						onClick={(e) => {
							e.stopPropagation();
							decrement();
						}}
					>
						<Minus className="h-4 w-4" />
						<span className="sr-only">
							{t("components:counterCheckbox.decreaseCount")}
						</span>
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="h-10 w-10 rounded-l-none border-l-0"
						onClick={(e) => {
							e.stopPropagation();
							increment();
						}}
					>
						<Plus className="h-4 w-4" />
						<span className="sr-only">
							{t("components:counterCheckbox.increaseCount")}
						</span>
					</Button>
				</ButtonGroup>
			)}
		</div>
	);
}
