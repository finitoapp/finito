"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FC, type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export const FadeHeader: FC<{
	title: ReactNode;
	endAddon?: React.ReactNode;
	startAddon?: React.ReactNode | null;
}> = (props) => {
	const divRef = useRef<HTMLDivElement>(null);
	const router = useRouter();

	useEffect(() => {
		const handleScroll = () => {
			// Calculate opacity based on scroll position
			// Fade out completely after scrolling 300px
			const scrollY = window.scrollY;
			const fadeDistance = 50;
			const newOpacity = Math.max(0, 1 - scrollY / fadeDistance);

			if (divRef.current) {
				divRef.current.style.opacity = newOpacity.toString();
				divRef.current.style.top = `calc(env(safe-area-inset-top) + ${(0 - scrollY / 3).toString()}px)`;
			}
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const startAddon =
		props.startAddon === undefined ? (
			<Button type={"button"} variant={"ghost"} onClick={() => router.back()}>
				<ArrowLeftIcon className={"text-primary size-5"} strokeWidth={3} />
			</Button>
		) : (
			props.startAddon
		);

	return (
		<div
			ref={divRef}
			className="text-center fixed left-0 right-0"
			style={{ opacity: 1, top: "env(safe-area-inset-top)" }}
		>
			<div className="relative flex flex-row w-full justify-center">
				<div className="max-w-xl px-4 py-5 flex flex-1 flex-row justify-between gap-4">
					<div className={"w-10"}>{startAddon}</div>
					<h2 className="flex-1 shrink text-xl font-bold text-foreground m-auto">
						{props.title}
					</h2>
					<div className={"w-10"}>{props.endAddon}</div>
				</div>
			</div>
		</div>
	);
};
