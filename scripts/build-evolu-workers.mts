import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const outputDir = path.join(rootDir, "public", "evolu");

const sqliteAssetNames = [
	"sqlite3-bundler-friendly.mjs",
	"sqlite3-worker1-bundler-friendly.mjs",
	"sqlite3-opfs-async-proxy.js",
	"sqlite3.wasm",
];

async function buildWorkers() {
	await rm(outputDir, { force: true, recursive: true });
	await mkdir(outputDir, { recursive: true });

	await build({
		entryPoints: {
			"Db.worker": path.join(
				rootDir,
				"node_modules/@evolu/web/src/local-first/Db.worker.ts",
			),
			"Shared.worker": path.join(
				rootDir,
				"node_modules/@evolu/web/src/local-first/Shared.worker.ts",
			),
		},
		bundle: true,
		format: "esm",
		legalComments: "none",
		platform: "browser",
		target: "es2022",
		outdir: outputDir,
		entryNames: "[name]",
		logLevel: "silent",
	});

	for (const assetName of sqliteAssetNames) {
		await cp(
			path.join(
				rootDir,
				"node_modules/@evolu/sqlite-wasm/sqlite-wasm/jswasm",
				assetName,
			),
			path.join(outputDir, assetName),
		);
	}
}

await buildWorkers();
