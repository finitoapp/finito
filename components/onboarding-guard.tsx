"use client";

import { useAtomValue } from "jotai";
import { hasDeviceAccountAtom } from "@/atoms/account";

export const OnboardingGuard = (props: { children: React.ReactNode }) => {
	const accountState = useAtomValue(hasDeviceAccountAtom);
	if (!accountState) {
		throw new Promise((resolve) => setTimeout(resolve, 20_000)); // Simulate suspense
	}

	return <>{props.children}</>;
};
