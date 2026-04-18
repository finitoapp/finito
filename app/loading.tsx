"use client";

import { useAtomValue } from "jotai";
import { Loader2Icon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { hasDeviceAccountAtom } from "@/atoms/account";
import { FinitoLogo } from "@/components/finito-logo";

const createReturnToUrl = (pathname: string, query: string) =>
	`${pathname}${query !== "" ? `?${query}` : ""}`;

const createOnboardingUrl = (returnTo: string) => {
	const params = new URLSearchParams();
	params.set("returnTo", returnTo);

	return `/onboarding?${params.toString()}`;
};

export default function Loading() {
	const { t } = useTranslation();
	const rootRef = useRef<HTMLDivElement | null>(null);
	const accountState = useAtomValue(hasDeviceAccountAtom);
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	useEffect(() => {
		if (!accountState && !pathname.startsWith("/onboarding")) {
			const returnTo = createReturnToUrl(pathname, searchParams.toString());
			router.replace(createOnboardingUrl(returnTo) as never);
		}
	}, [accountState, pathname, searchParams, router.replace]);

	useEffect(() => {
		const mountedNode = rootRef.current;

		return () => {
			if (!mountedNode) {
				return;
			}

			const ghost = mountedNode.cloneNode(true) as HTMLDivElement;
			ghost.style.position = "fixed";
			ghost.style.inset = "0";
			ghost.style.zIndex = "9999";
			ghost.style.pointerEvents = "none";

			document.body.appendChild(ghost);
			const animation = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: 250,
				easing: "ease-out",
				fill: "forwards",
			});
			animation.addEventListener("finish", () => {
				ghost.remove();
			});
		};
	}, []);

	return (
		<div
			ref={rootRef}
			className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
		>
			<div className="flex min-w-72 flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-xl">
				<FinitoLogo className="text-2xl" />
				<div className="flex items-center gap-3 text-muted-foreground">
					<Loader2Icon className="size-4 animate-spin text-primary" />
					<span className="text-sm">{t("app:loading.preparingWorkspace")}</span>
				</div>
			</div>
		</div>
	);
}
