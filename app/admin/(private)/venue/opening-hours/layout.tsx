"use client";

import { SubNavShellContent } from "@/components/sub-nav-shell";

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	return (
		<SubNavShellContent title={"Opening Hours"}>
			{props.children}
		</SubNavShellContent>
	);
}
