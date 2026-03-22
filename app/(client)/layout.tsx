"use client";

import { ViewTransition } from "react";
import { useBackgroundProcesses } from "@/hooks/use-background-processes";

export default function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	useBackgroundProcesses();

	return (
		<div className="flex flex-col w-full justify-center flex-1 items-center">
			<ViewTransition>
				<div className="flex flex-1 w-full max-w-xl">{children}</div>

				<div className={"h-18 max-w-xl"}></div>
			</ViewTransition>
		</div>
	);
}
