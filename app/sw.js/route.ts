import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";
import { getPrecacheEntries } from "@/lib/serwist/get-precache-routes";

const revision =
	spawnSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf-8",
	}).stdout.trim() || crypto.randomUUID();
const additionalPrecacheEntries = await getPrecacheEntries(revision);
const additionalPrecacheUrls =
	process.env.NODE_ENV === "development"
		? []
		: Array.from(
				new Set(
					additionalPrecacheEntries.map((entry) =>
						typeof entry === "string" ? entry : entry.url,
					),
				),
			);

const route = createSerwistRoute({
	additionalPrecacheEntries,
	swSrc: "app/sw.ts",
	useNativeEsbuild: true,
	maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
	esbuildOptions: {
		define: {
			__FINITO_ADDITIONAL_PRECACHE_URLS__: JSON.stringify(
				additionalPrecacheUrls,
			),
		},
	},
});

export const { dynamic, dynamicParams, revalidate } = route;

export async function GET(request: Request) {
	return route.GET(request, { params: Promise.resolve({ path: "sw.js" }) });
}
