"use client";

import { Maximize, Minimize } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

interface FullscreenContainerProps {
	children: ReactNode;
	className?: string;
	title?: string;
}

export function FullscreenContainer({
	children,
	className = "",
	title,
}: FullscreenContainerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);

	// Listen for fullscreen changes
	useEffect(() => {
		const handleFullscreenChange = () => {
			const isCurrentlyFullscreen =
				document.fullscreenElement || (document as any).webkitFullscreenElement;
			setIsFullscreen(!!isCurrentlyFullscreen);
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
			document.removeEventListener(
				"webkitfullscreenchange",
				handleFullscreenChange,
			);
		};
	}, []);

	const handleToggleFullscreen = async () => {
		if (!containerRef.current) return;

		try {
			if (!isFullscreen) {
				// Request fullscreen
				if (containerRef.current.requestFullscreen) {
					await containerRef.current.requestFullscreen();
				} else if ((containerRef.current as any).webkitRequestFullscreen) {
					await (containerRef.current as any).webkitRequestFullscreen();
				}
			} else {
				// Exit fullscreen
				if (document.fullscreenElement) {
					await document.exitFullscreen();
				} else if ((document as any).webkitFullscreenElement) {
					await (document as any).webkitExitFullscreen();
				}
			}
		} catch (error) {
			console.error("Fullscreen toggle failed:", error);
		}
	};

	return (
		<div
			ref={containerRef}
			className={`relative flex flex-col bg-background rounded-lg border border-border overflow-hidden ${className}`}
		>
			{/* Header with fullscreen button */}
			<div className="flex items-center justify-between gap-4 border-b border-border bg-muted/50 px-3 py-2">
				{title && <h2 className="text-lg font-semibold">{title}</h2>}
				<div className="flex-1" />
				<Button
					variant="ghost"
					size="icon"
					onClick={handleToggleFullscreen}
					title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
					aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
				>
					{isFullscreen ? (
						<Minimize className="h-4 w-4" />
					) : (
						<Maximize className="h-4 w-4" />
					)}
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-auto">{children}</div>
		</div>
	);
}
