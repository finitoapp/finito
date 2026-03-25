"use client";

import { useAtomValue } from "jotai";
import { loadable } from "jotai/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { hasDeviceAccountAtom } from "@/atoms/account";
import { Spinner } from "@/components/ui/spinner";

const hasDeviceAccountLoadableAtom = loadable(hasDeviceAccountAtom);

const createReturnToUrl = (pathname: string, query: string) =>
	`${pathname}${query !== "" ? `?${query}` : ""}`;

const createOnboardingUrl = (returnTo: string) => {
	const params = new URLSearchParams();
	params.set("returnTo", returnTo);

	return `/onboarding?${params.toString()}`;
};

const GuardFallback = () => {
	const { t } = useTranslation();

	return (
		<div className="flex flex-1 items-center justify-center gap-3">
			<Spinner className="size-5" />
			<span>{t("app:loading.preparingWorkspace")}</span>
		</div>
	);
};

export const OnboardingGuard = (props: { children: React.ReactNode }) => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const accountState = useAtomValue(hasDeviceAccountLoadableAtom);

	const currentQuery = searchParams.toString();
	const returnTo = useMemo(
		() => createReturnToUrl(pathname, currentQuery),
		[pathname, currentQuery],
	);
	const onboardingUrl = useMemo(
		() => createOnboardingUrl(returnTo),
		[returnTo],
	);

	useEffect(() => {
		if (accountState.state === "hasData" && !accountState.data) {
			router.replace(onboardingUrl as never);
		}
	}, [accountState, onboardingUrl, router]);

	if (accountState.state === "loading") {
		return <GuardFallback />;
	}

	if (accountState.state === "hasError") {
		throw accountState.error;
	}

	if (!accountState.data) {
		return <GuardFallback />;
	}

	return <>{props.children}</>;
};
