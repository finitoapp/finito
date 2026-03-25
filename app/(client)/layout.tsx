"use client";

import { ViewTransition } from "react";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { useBackgroundProcesses } from "@/hooks/use-background-processes";

const ClientLayoutContent = ({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) => {
	useBackgroundProcesses();

	return (
		<div className="flex flex-col w-full justify-center flex-1 items-center">
			<ViewTransition>
				<div className="flex flex-1 w-full max-w-xl">{children}</div>

				<div className={"h-18 max-w-xl"}></div>
			</ViewTransition>
		</div>
	);
};

export default function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<OnboardingGuard>
			<ClientLayoutContent>{children}</ClientLayoutContent>
		</OnboardingGuard>
	);
}
