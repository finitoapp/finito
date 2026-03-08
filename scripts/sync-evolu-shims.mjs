import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const evoluDir = path.join(rootDir, "node_modules", "@evolu");
const monorepoDir = path.join(evoluDir, "monorepo", "packages");
const tscBin = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");

const packageTemplates = {
	common: {
		name: "@evolu/common",
		version: "7.4.1",
		private: true,
		type: "module",
		types: "./dist/src/index.d.ts",
		exports: {
			".": {
				types: "./dist/src/index.d.ts",
				import: "./dist/src/index.js",
				browser: "./dist/src/index.js",
				"react-native": "./dist/src/index.js",
				default: "./dist/src/index.js",
			},
			"./local-first": {
				types: "./dist/src/local-first/index.d.ts",
				import: "./dist/src/local-first/index.js",
				default: "./dist/src/local-first/index.js",
			},
			"./polyfills": {
				types: "./dist/src/Polyfills.d.ts",
				import: "./dist/src/Polyfills.js",
				browser: "./dist/src/Polyfills.js",
				"react-native": "./dist/src/Polyfills.js",
				default: "./dist/src/Polyfills.js",
			},
		},
		typesVersions: {
			"*": {
				polyfills: ["./dist/src/Polyfills.d.ts"],
				"local-first": ["./dist/src/local-first/index.d.ts"],
			},
		},
		dependencies: {
			"@noble/ciphers": "^2.1.1",
			"@noble/hashes": "^2.0.1",
			"@scure/bip39": "^2.0.1",
			kysely: "^0.28.10",
			msgpackr: "^1.11.8",
			random: "^5.4.1",
		},
		engines: {
			node: ">=24.0.0",
		},
		sideEffects: false,
	},
	react: {
		name: "@evolu/react",
		version: "10.4.0",
		private: true,
		type: "module",
		types: "./dist/src/index.d.ts",
		exports: {
			".": {
				types: "./dist/src/index.d.ts",
				import: "./dist/src/index.js",
				browser: "./dist/src/index.js",
				"react-native": "./dist/src/index.js",
			},
		},
		peerDependencies: {
			"@evolu/common": "^7.4.1",
			react: ">=19",
		},
		engines: {
			node: ">=24.0.0",
		},
		sideEffects: false,
	},
	"react-web": {
		name: "@evolu/react-web",
		version: "2.4.0",
		private: true,
		type: "module",
		types: "./dist/src/index.d.ts",
		exports: {
			".": {
				types: "./dist/src/index.d.ts",
				import: "./dist/src/index.js",
				browser: "./dist/src/index.js",
			},
		},
		peerDependencies: {
			"@evolu/common": "^7.4.1",
			"@evolu/web": "^2.4.0",
			react: ">=19",
			"react-dom": ">=19",
		},
		engines: {
			node: ">=24.0.0",
		},
		sideEffects: false,
	},
	web: {
		name: "@evolu/web",
		version: "2.4.0",
		private: true,
		type: "module",
		types: "./dist/src/index.d.ts",
		exports: {
			".": {
				types: "./dist/src/index.d.ts",
				import: "./dist/src/index.js",
				browser: "./dist/src/index.js",
			},
		},
		dependencies: {
			"@evolu/sqlite-wasm": "2.2.4",
			"idb-keyval": "^6.2.2",
		},
		peerDependencies: {
			"@evolu/common": "^7.4.1",
		},
		engines: {
			node: ">=24.0.0",
		},
		sideEffects: false,
	},
};

const packages = [
	{ name: "common", files: ["src", "README.md"], extraTypes: ["node"] },
	{
		name: "web",
		files: ["src", "README.md"],
		extraTypes: ["node", "user-agent-data-types"],
	},
	{ name: "react", files: ["src", "README.md"], extraTypes: ["node"] },
	{
		name: "react-web",
		files: ["src", "README.md"],
		extraTypes: ["node", "user-agent-data-types"],
	},
];

if (!existsSync(monorepoDir)) {
	console.error(`Missing Evolu monorepo at ${monorepoDir}`);
	process.exit(1);
}

for (const { name, files } of packages) {
	const sourceDir = path.join(monorepoDir, name);
	const targetDir = path.join(evoluDir, name);
	const targetPackageJsonPath = path.join(targetDir, "package.json");

	if (!existsSync(sourceDir)) {
		console.error(`Missing Evolu package source at ${sourceDir}`);
		process.exit(1);
	}

	mkdirSync(targetDir, { recursive: true });

	for (const file of files) {
		const sourcePath = path.join(sourceDir, file);
		const targetPath = path.join(targetDir, file);

		rmSync(targetPath, { force: true, recursive: true });

		if (existsSync(sourcePath)) {
			cpSync(sourcePath, targetPath, { recursive: true });
		}
	}

	const packageJson = structuredClone(packageTemplates[name]);
	packageJson.version = JSON.parse(
		readFileSync(path.join(sourceDir, "package.json"), "utf8"),
	).version;
	writeFileSync(
		targetPackageJsonPath,
		`${JSON.stringify(packageJson, null, 2)}\n`,
	);

	if (name === "web") {
		const taskPath = path.join(targetDir, "src", "Task.ts");
		const taskSource = readFileSync(taskPath, "utf8")
			.replace(
				'(event) => {\n      console.error("error", createUnknownError(event.error));',
				'(event: ErrorEvent) => {\n      console.error("error", createUnknownError(event.error));',
			)
			.replace(
				'(event) => {\n      console.error("unhandledrejection", createUnknownError(event.reason));',
				'(event: PromiseRejectionEvent) => {\n      console.error("unhandledrejection", createUnknownError(event.reason));',
			);
		writeFileSync(taskPath, taskSource);
	}
}

for (const { name, extraTypes } of packages) {
	const targetDir = path.join(evoluDir, name);
	const tsconfigPath = path.join(targetDir, "tsconfig.sync.json");

	rmSync(path.join(targetDir, "dist"), { force: true, recursive: true });

	const tsconfig = {
		compilerOptions: {
			composite: true,
			incremental: true,
			declaration: true,
			declarationMap: true,
			esModuleInterop: true,
			forceConsistentCasingInFileNames: true,
			inlineSources: false,
			verbatimModuleSyntax: true,
			noUnusedLocals: false,
			noUnusedParameters: false,
			preserveWatchOutput: true,
			skipLibCheck: true,
			strict: true,
			exactOptionalPropertyTypes: true,
			noErrorTruncation: false,
			erasableSyntaxOnly: true,
			jsx: "react-jsx",
			lib: ["dom", "dom.iterable", "esnext"],
			module: "nodenext",
			moduleResolution: "nodenext",
			target: "es2022",
			outDir: "dist",
			rootDir: ".",
			resolveJsonModule: true,
			tsBuildInfoFile: "dist/.tsBuildInfo",
			types: extraTypes,
		},
		include: ["src"],
		exclude: ["dist", "node_modules", "test"],
	};

	writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

	const result = spawnSync(process.execPath, [tscBin, "-p", tsconfigPath], {
		cwd: targetDir,
		stdio: "inherit",
	});

	rmSync(tsconfigPath, { force: true });

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
