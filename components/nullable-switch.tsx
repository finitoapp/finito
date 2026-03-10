"use client";

import * as React from "react";
import { cn } from "@/lib/shared/ui/cn";

export type NullableBoolean = boolean | null;

interface NullableSwitchProps {
	value: NullableBoolean;
	onChange?: (value: NullableBoolean) => void;
	onBlur?: React.FocusEventHandler<HTMLInputElement>;
	disabled?: boolean;
	id?: string;
	name?: string;
	className?: string;
}

/**
 * Cycles through the three states:
 *   null  →  true  →  false  →  null  → …
 *
 * Visual states:
 *   null  – centre dot, muted track  (indeterminate / unset)
 *   true  – thumb right, green track (on)
 *   false – thumb left, red track    (off)
 */
export function NullableSwitch({
	value,
	onChange,
	onBlur,
	disabled = false,
	id,
	name,
	className,
}: NullableSwitchProps) {
	const inputRef = React.useRef<HTMLInputElement>(null);
	const inputId = id ?? name;

	React.useEffect(() => {
		if (inputRef.current) {
			inputRef.current.indeterminate = value === null;
		}
	}, [value]);

	function cycle() {
		if (disabled) return;
		if (value === null) onChange?.(true);
		else if (value) onChange?.(false);
		else onChange?.(null);
	}

	function handleClick(event: React.MouseEvent<HTMLInputElement>) {
		event.preventDefault();
		cycle();
	}

	const rootClass = cn("relative inline-flex h-6 w-11 shrink-0", className);

	const trackClass = cn(
		"relative inline-flex h-full w-full cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 ease-in-out peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
		{
			"bg-switch-null": value === null,
			"bg-switch-true": value === true,
			"bg-switch-false": value === false,
			"cursor-not-allowed opacity-50": disabled,
		},
	);

	function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter") {
			event.preventDefault();
			cycle();
		}
	}

	// Thumb position: null → centre, true → right, false → left
	const thumbTranslate =
		value === null
			? "translate-x-[10px]"
			: value
				? "translate-x-5"
				: "translate-x-0";

	return (
		<span className={rootClass}>
			<input
				ref={inputRef}
				id={inputId}
				name={name}
				type="checkbox"
				checked={value === true}
				readOnly
				aria-checked={value === null ? "mixed" : value}
				disabled={disabled}
				onBlur={onBlur}
				onClick={handleClick}
				onKeyDown={handleInputKeyDown}
				className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
			/>
			<span className={trackClass} aria-hidden="true">
				<span
					className={cn(
						"pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out",
						thumbTranslate,
					)}
				>
					{/* Inner icon to communicate the state */}
					<span className="flex h-full w-full items-center justify-center">
						{value === null && (
							<span className="block h-1.5 w-1.5 rounded-full bg-switch-null-dot" />
						)}
						{value === true && (
							<svg
								viewBox="0 0 10 10"
								className="h-3 w-3 text-switch-true"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M2 5.5L4 7.5L8 3"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
						{value === false && (
							<svg
								viewBox="0 0 10 10"
								className="h-2.5 w-2.5 text-switch-false"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M3 3L7 7M7 3L3 7"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
						)}
					</span>
				</span>
			</span>
		</span>
	);
}
