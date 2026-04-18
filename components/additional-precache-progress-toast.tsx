"use client";

import { useSerwist } from "@serwist/turbopack/react";
import { useEffect, useEffectEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	type AdditionalPrecacheProgressPayload,
	GET_ADDITIONAL_PRECACHE_PROGRESS_MESSAGE,
	isAdditionalPrecacheProgressMessage,
} from "@/lib/serwist/additional-precache-progress";

const TOAST_ID = "additional-precache-progress";

export const AdditionalPrecacheProgressToast = () => {
	const { serwist } = useSerwist();
	const { t } = useTranslation("app");
	const hasVisibleToastRef = useRef(false);

	const dismissToast = useEffectEvent(() => {
		if (!hasVisibleToastRef.current) return;

		toast.dismiss(TOAST_ID);
		hasVisibleToastRef.current = false;
	});

	const showRunningToast = useEffectEvent(
		(payload: AdditionalPrecacheProgressPayload) => {
			const percent =
				payload.total === 0
					? 0
					: Math.round((payload.completed / payload.total) * 100);

			toast.loading(t("precacheProgress.running.title"), {
				id: TOAST_ID,
				description: (
					<div className="w-full space-y-1.5">
						<div className="flex w-full items-center gap-3">
							<p className="text-xs font-normal text-muted-foreground">
								{t("precacheProgress.running.description", {
									completed: payload.completed,
									total: payload.total,
								})}
							</p>
							<p className="ml-auto text-xs text-muted-foreground tabular-nums">
								{percent}%
							</p>
						</div>
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-[width]"
								style={{ width: `${percent}%` }}
							/>
						</div>
					</div>
				),
				dismissible: false,
				duration: Number.POSITIVE_INFINITY,
				onDismiss: () => {
					hasVisibleToastRef.current = false;
				},
			});

			hasVisibleToastRef.current = true;
		},
	);

	const showCompletedToast = useEffectEvent(
		(payload: AdditionalPrecacheProgressPayload) => {
			if (!hasVisibleToastRef.current) return;

			toast.success(t("precacheProgress.complete.title"), {
				id: TOAST_ID,
				description: t("precacheProgress.complete.description", {
					total: payload.total,
				}),
				duration: 4000,
				onAutoClose: () => {
					hasVisibleToastRef.current = false;
				},
				onDismiss: () => {
					hasVisibleToastRef.current = false;
				},
			});
		},
	);

	const handleProgress = useEffectEvent(
		(payload: AdditionalPrecacheProgressPayload) => {
			if (payload.total === 0 || payload.status === "idle") {
				dismissToast();
				return;
			}

			if (payload.status === "running") {
				showRunningToast(payload);
				return;
			}

			if (payload.status === "complete") {
				showCompletedToast(payload);
				return;
			}

			dismissToast();
		},
	);

	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;

		const handleMessage = (event: MessageEvent<unknown>) => {
			if (!isAdditionalPrecacheProgressMessage(event.data)) return;

			handleProgress(event.data.payload);
		};

		navigator.serviceWorker.addEventListener("message", handleMessage);

		void (async () => {
			if (!serwist) return;

			try {
				const response = await serwist.messageSW({
					type: GET_ADDITIONAL_PRECACHE_PROGRESS_MESSAGE,
				});

				if (isAdditionalPrecacheProgressMessage(response)) {
					handleProgress(response.payload);
				}
			} catch {
				// The worker might not be ready yet. Broadcast updates will still arrive.
			}
		})();

		return () => {
			navigator.serviceWorker.removeEventListener("message", handleMessage);
			dismissToast();
		};
	}, [serwist]);

	return null;
};
