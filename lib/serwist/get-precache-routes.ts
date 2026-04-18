import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ManifestEntry } from "@serwist/build";

function toPosix(path: string) {
	return path.split(sep).join("/");
}

function isPageFile(name: string) {
	return /^page\.(tsx|ts|jsx|js|mdx)$/.test(name);
}

function shouldIgnoreSegment(segment: string) {
	// Route groups: (marketing)
	if (segment.startsWith("(") && segment.endsWith(")")) return true;

	// Private folders: _components
	if (segment.startsWith("_")) return true;

	// Slots / parallel routes: @modal
	if (segment.startsWith("@")) return true;

	return false;
}

function isDynamicSegment(segment: string) {
	return segment.startsWith("[") && segment.endsWith("]");
}

function walk(dir: string, out: string[] = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);

		if (stat.isDirectory()) {
			walk(full, out);
			continue;
		}

		if (stat.isFile() && isPageFile(entry)) {
			out.push(full);
		}
	}

	return out;
}

function appFileToUrl(appDir: string, file: string): string | null {
	const rel = toPosix(relative(appDir, file));
	const parts = rel.split("/");

	// remove trailing page.tsx
	parts.pop();

	const urlParts: string[] = [];

	for (const part of parts) {
		if (shouldIgnoreSegment(part)) continue;
		if (isDynamicSegment(part)) return null; // Static scanning does not know dynamic URLs.
		urlParts.push(part);
	}

	const url = `/${urlParts.join("/")}`;
	return url === "/" ? "/" : url.replace(/\/+/g, "/");
}

export function getStaticAppRoutes(): string[] {
	const appDir = statSync("src", { throwIfNoEntry: false })?.isDirectory()
		? join(process.cwd(), "src", "app")
		: join(process.cwd(), "app");

	const files = walk(appDir);
	const urls = files
		.map((file) => appFileToUrl(appDir, file))
		.filter((x): x is string => Boolean(x))
		.flatMap((value) => [value, value === "/" ? "/index.txt" : `${value}.txt`]);

	return Array.from(new Set(urls)).sort();
}

// Add build-time generation of dynamic URLs here.
export async function getDynamicAppRoutes(): Promise<string[]> {
	// Example:
	// const posts = await loadAllPosts();
	// return posts.map((post) => `/blog/${post.slug}`);

	return [];
}

export async function getPrecacheEntries(
	revision: string,
): Promise<(string | ManifestEntry)[]> {
	const staticRoutes = getStaticAppRoutes();
	const dynamicRoutes = await getDynamicAppRoutes();

	const urls = Array.from(
		new Set([...staticRoutes, ...dynamicRoutes, "/~offline"]),
	).sort();

	return urls.map((url) => ({ url, revision }));
}
