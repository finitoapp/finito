/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import {
	type PrecacheEntry,
	Serwist,
	type SerwistGlobalConfig,
	type SerwistPlugin,
} from "serwist";
import {
	ADDITIONAL_PRECACHE_PROGRESS_MESSAGE,
	type AdditionalPrecacheProgressMessage,
	type AdditionalPrecacheProgressPayload,
	isGetAdditionalPrecacheProgressMessage,
} from "@/lib/serwist/additional-precache-progress";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;
declare const __FINITO_ADDITIONAL_PRECACHE_URLS__: string[];

const additionalPrecacheUrlSet = new Set(
	__FINITO_ADDITIONAL_PRECACHE_URLS__.map(
		(url) => new URL(url, self.location.origin).href,
	),
);

let completedAdditionalPrecacheUrls = new Set<string>();
let additionalPrecacheProgress: AdditionalPrecacheProgressPayload = {
	completed: 0,
	status: "idle",
	total: additionalPrecacheUrlSet.size,
};

const createAdditionalPrecacheProgressMessage =
	(): AdditionalPrecacheProgressMessage => ({
		type: ADDITIONAL_PRECACHE_PROGRESS_MESSAGE,
		payload: additionalPrecacheProgress,
	});

const broadcastAdditionalPrecacheProgress = async () => {
	const clients = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	const message = createAdditionalPrecacheProgressMessage();

	for (const client of clients) {
		client.postMessage(message);
	}
};

const resetAdditionalPrecacheProgress = () => {
	completedAdditionalPrecacheUrls = new Set();
	additionalPrecacheProgress = {
		completed: 0,
		status: additionalPrecacheUrlSet.size > 0 ? "running" : "idle",
		total: additionalPrecacheUrlSet.size,
	};
};

const additionalPrecacheProgressPlugin: SerwistPlugin = {
	handlerDidComplete: async ({ event, error, request }) => {
		if (event.type !== "install") return;
		if (!additionalPrecacheUrlSet.has(request.url)) return;
		if (additionalPrecacheProgress.status === "error") return;

		if (error) {
			additionalPrecacheProgress = {
				...additionalPrecacheProgress,
				status: "error",
			};
			await broadcastAdditionalPrecacheProgress();
			return;
		}

		if (completedAdditionalPrecacheUrls.has(request.url)) return;

		completedAdditionalPrecacheUrls.add(request.url);
		additionalPrecacheProgress = {
			completed: completedAdditionalPrecacheUrls.size,
			status:
				completedAdditionalPrecacheUrls.size === additionalPrecacheUrlSet.size
					? "complete"
					: "running",
			total: additionalPrecacheUrlSet.size,
		};

		await broadcastAdditionalPrecacheProgress();
	},
};

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	runtimeCaching: defaultCache,
	fallbacks: {
		entries: [
			{
				url: "/~offline",
				matcher({ request }) {
					return request.destination === "document";
				},
			},
		],
	},
	precacheOptions: {
		ignoreURLParametersMatching: [/.*/],
		cleanupOutdatedCaches: true,
	},
});

serwist.precacheStrategy.plugins.push(additionalPrecacheProgressPlugin);

self.addEventListener("install", (event) => {
	if (additionalPrecacheUrlSet.size === 0) return;

	resetAdditionalPrecacheProgress();
	event.waitUntil(broadcastAdditionalPrecacheProgress());
});

self.addEventListener("message", (event) => {
	if (!isGetAdditionalPrecacheProgressMessage(event.data)) return;

	event.waitUntil(
		(async () => {
			event.ports[0]?.postMessage(createAdditionalPrecacheProgressMessage());
		})(),
	);
});

serwist.addEventListeners();
