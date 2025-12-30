"use client";

import { type FC, useEffect, useRef } from "react";

export const FadeHeader: FC<{
	title: string;
}> = (props) => {
	const divRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleScroll = () => {
			// Calculate opacity based on scroll position
			// Fade out completely after scrolling 300px
			const scrollY = window.scrollY;
			const fadeDistance = 50;
			const newOpacity = Math.max(0, 1 - scrollY / fadeDistance);

			if (divRef.current) {
				divRef.current.style.opacity = newOpacity.toString();
				divRef.current.style.top = `${(0 - scrollY / 3).toString()}px`;
			}
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<div
			ref={divRef}
			className="text-center fixed left-0 right-0 -z-10"
			style={{ opacity: 1, top: "env(safe-area-inset-top)" }}
		>
			<div className="relative flex flex-row w-full justify-center">
				<div className="max-w-xl px-4 py-10 flex flex-1 flex-row justify-between gap-4">
					<h2 className="text-2xl font-bold text-foreground m-auto">
						{props.title}
					</h2>
				</div>
			</div>
		</div>
	);
};
