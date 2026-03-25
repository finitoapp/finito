"use client";

import { useAtomValue } from "jotai";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { hasDeviceAccountAtom } from "@/atoms/account";

const createReturnToUrl = (pathname: string, query: string) =>
	`${pathname}${query !== "" ? `?${query}` : ""}`;

const createOnboardingUrl = (returnTo: string) => {
	const params = new URLSearchParams();
	params.set("returnTo", returnTo);

	return `/onboarding?${params.toString()}`;
};

export const OnboardingGuard = (props: { children: React.ReactNode }) => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const accountState = useAtomValue(hasDeviceAccountAtom);
	const redirectRef = useRef(false);

	if (!accountState) {
		if (!redirectRef.current) {
			redirectRef.current = true;
			const returnTo = createReturnToUrl(pathname, searchParams.toString());
			router.replace(createOnboardingUrl(returnTo) as never);
		}

		throw new Promise((resolve) => setTimeout(resolve, 20_000)); // Simulate suspense
	}

	return <>{props.children}</>;
};
