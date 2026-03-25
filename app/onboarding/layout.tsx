"use client";

import { ViewTransition } from "react";
import { OnboardingPreferences } from "@/app/onboarding/onboarding-preferences";
import { Card, CardContent } from "@/components/ui/card";

export default function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div className="bg-background flex flex-1 items-center justify-center px-4 py-8">
			<div className="flex w-full max-w-3xl flex-col gap-4">
				<ViewTransition>
					<Card className={"overflow-hidden p-0"}>
						<CardContent className={"p-0"}>{children}</CardContent>
					</Card>
				</ViewTransition>
				<OnboardingPreferences />
			</div>
		</div>
	);
}
