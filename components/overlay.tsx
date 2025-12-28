"use client";

import type React from "react";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface OverlayProps {
	isOpen: boolean;
	onClose?: () => void;
	children?: React.ReactNode;
	className?: string;
	closeOnClick?: boolean;
}

export function Overlay({
	isOpen,
	onClose,
	children,
	className,
	closeOnClick = true,
}: OverlayProps) {
	// Prevent body scroll when overlay is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		<>
			<button
				type={"button"}
				className={cn(
					"fixed inset-0 z-50 bg-black/30 [backdrop-filter:blur(4px)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					className,
				)}
				onClick={closeOnClick ? onClose : undefined}
			/>
			<div className="relative z-50 max-w-2xl w-full">{children}</div>
		</>
	);
}
