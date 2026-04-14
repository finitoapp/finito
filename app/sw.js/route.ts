import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

const revision =
	spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ??
	crypto.randomUUID();

const route = createSerwistRoute({
	additionalPrecacheEntries: [{ url: "/~offline", revision }],
	swSrc: "app/sw.ts",
	useNativeEsbuild: true,
	maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
});

export const { dynamic, dynamicParams, revalidate } = route;

export async function GET(request: Request) {
	return route.GET(request, { params: Promise.resolve({ path: "sw.js" }) });
}
