"use client";

import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type React from "react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
	fallbackHref?: Route;
	className?: string;
	children?: React.ReactNode;
}

export function BackButton({
	fallbackHref,
	className,
	children,
}: BackButtonProps) {
	const router = useRouter();

	const handleBack = () => {
		// Check if there's history to go back to
		if (window.history.length > 1) {
			router.back();
		} else {
			// Fallback to a specific route if no history
			router.push(fallbackHref ?? "/");
		}
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={handleBack}
			className={className}
		>
			<ArrowLeft className="h-4 w-4 mr-2" />
			{children || "Back"}
		</Button>
	);
}
