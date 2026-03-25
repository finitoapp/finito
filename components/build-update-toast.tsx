"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { jsonCodec } from "@/lib/shared/zod/json-codec";

const VERSION_ENDPOINT = "/version.json";
// Polling every 10 minutes keeps checks outside short CDN edge cache windows.
const CHECK_PERIOD_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8 * 1000;

const currentBuildVersion = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "unknown";

const schema = jsonCodec(
	z.object({
		version: z.string(),
		builtAt: z.string(),
	}),
);

const fetchLatestVersion = async (signal: AbortSignal) => {
	const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
		cache: "no-store",
		headers: {
			"cache-control": "no-cache",
		},
		signal,
	});

	if (!response.ok) {
		return null;
	}

	const payload = await response.text();
	const result = schema.safeDecode(payload);
	console.log("payload", payload);
	console.log("result", result);
	return result.success ? result.data : null;
};

export const BuildUpdateToast = () => {
	const { t } = useTranslation("app");
	const isMountedRef = useRef(false);
	const isCheckingRef = useRef(false);
	const toastIdRef = useRef<ReturnType<typeof toast> | null>(null);

	const showToast = useEffectEvent(() => {
		if (toastIdRef.current !== null) {
			return;
		}

		toastIdRef.current = toast(t("buildUpdate.available.title"), {
			description: t("buildUpdate.available.description"),
			duration: Number.POSITIVE_INFINITY,
			action: {
				label: t("buildUpdate.available.reload"),
				onClick: () => {
					window.location.reload();
				},
			},
			cancel: {
				label: t("buildUpdate.available.later"),
				onClick: () => {
					if (toastIdRef.current !== null) {
						toast.dismiss(toastIdRef.current);
					}
				},
			},
			onDismiss: () => {
				toastIdRef.current = null;
			},
		});
	});

	const checkForNewBuild = useEffectEvent(async () => {
		if (!isMountedRef.current) {
			return;
		}

		if (toastIdRef.current !== null) {
			return;
		}

		if (isCheckingRef.current) {
			return;
		}

		isCheckingRef.current = true;

		const abortController = new AbortController();
		const timeoutId = setTimeout(() => {
			abortController.abort();
		}, FETCH_TIMEOUT_MS);

		try {
			const latestVersion = await fetchLatestVersion(abortController.signal);
			if (latestVersion === null) return;
			if (latestVersion.version === currentBuildVersion) return;

			showToast();
		} catch {
			// Keep polling on the next interval tick.
		} finally {
			clearTimeout(timeoutId);
			isCheckingRef.current = false;
		}
	});

	useEffect(() => {
		isMountedRef.current = true;
		const intervalId = setInterval(() => {
			void checkForNewBuild();
		}, CHECK_PERIOD_MS);

		return () => {
			isMountedRef.current = false;
			clearInterval(intervalId);

			if (toastIdRef.current !== null) {
				toast.dismiss(toastIdRef.current);
			}
		};
	}, []);

	return null;
};
