#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../../..");

const configPath = resolve(projectRoot, "lib/i18n/config.ts");
const resourcesPath = resolve(projectRoot, "lib/i18n/resources.ts");
const localesRoot = resolve(projectRoot, "locales");

const fail = (message) => {
	console.error(`ERROR: ${message}`);
	process.exit(1);
};

if (!existsSync(configPath)) fail(`Missing file: ${configPath}`);
if (!existsSync(resourcesPath)) fail(`Missing file: ${resourcesPath}`);
if (!existsSync(localesRoot)) fail(`Missing directory: ${localesRoot}`);

const parseNamespacesFromConfig = () => {
	const source = readFileSync(configPath, "utf8");
	const match = source.match(/I18N_NAMESPACES\s*=\s*\[(.*?)\]\s*as const/s);
	if (!match) fail("Could not parse I18N_NAMESPACES from lib/i18n/config.ts");
	return [...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((it) => it[1]);
};

const parseNamespacesFromResources = (language) => {
	const source = readFileSync(resourcesPath, "utf8");
	const block = source.match(
		new RegExp(`${language}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`, "m"),
	);
	if (!block) {
		fail(`Could not parse resources block for language "${language}"`);
	}
	return [
		...block[1].matchAll(/\n\s*([a-z][a-z0-9-]*):\s*[a-z][a-zA-Z0-9]*/g),
	].map((it) => it[1]);
};

const parseLocaleFiles = (language) => {
	const langDir = resolve(localesRoot, language);
	if (!existsSync(langDir)) fail(`Missing locale directory: ${langDir}`);
	return readdirSync(langDir)
		.filter((file) => file.endsWith(".ts"))
		.map((file) => file.replace(/\.ts$/, ""));
};

const flattenLeafKeys = (value, prefix = "") => {
	const result = [];
	for (const [key, child] of Object.entries(value)) {
		const next = prefix === "" ? key : `${prefix}.${key}`;
		if (child !== null && typeof child === "object" && !Array.isArray(child)) {
			result.push(...flattenLeafKeys(child, next));
		} else {
			result.push(next);
		}
	}
	return result;
};

const loadLocale = async (language, namespace) => {
	const filePath = resolve(localesRoot, language, `${namespace}.ts`);
	if (!existsSync(filePath)) fail(`Missing locale file: ${filePath}`);
	const mod = await import(pathToFileURL(filePath).href);
	if (!("default" in mod) || mod.default === null || typeof mod.default !== "object") {
		fail(`Locale file does not export default object: ${filePath}`);
	}
	return mod.default;
};

const toSet = (items) => new Set(items);

const diff = (left, right) => left.filter((item) => !right.has(item));

const formatSample = (items) => items.slice(0, 8).join(", ");

const configNamespaces = parseNamespacesFromConfig();
const enFiles = parseLocaleFiles("en");
const csFiles = parseLocaleFiles("cs");
const enResources = parseNamespacesFromResources("en");
const csResources = parseNamespacesFromResources("cs");

const errors = [];

const configSet = toSet(configNamespaces);
const enFilesSet = toSet(enFiles);
const csFilesSet = toSet(csFiles);
const enResourcesSet = toSet(enResources);
const csResourcesSet = toSet(csResources);

const compareNamespaceSets = (label, left, right) => {
	const missing = diff(left, right);
	const extra = diff([...right], toSet(left));
	if (missing.length > 0) {
		errors.push(`${label}: missing namespaces: ${formatSample(missing)}`);
	}
	if (extra.length > 0) {
		errors.push(`${label}: extra namespaces: ${formatSample(extra)}`);
	}
};

compareNamespaceSets("config vs locales/en", configNamespaces, enFilesSet);
compareNamespaceSets("config vs locales/cs", configNamespaces, csFilesSet);
compareNamespaceSets("config vs resources.en", configNamespaces, enResourcesSet);
compareNamespaceSets("config vs resources.cs", configNamespaces, csResourcesSet);

const namespaceUniverse = [...configSet];

for (const namespace of namespaceUniverse) {
	const [enLocale, csLocale] = await Promise.all([
		loadLocale("en", namespace),
		loadLocale("cs", namespace),
	]);
	const enKeys = flattenLeafKeys(enLocale);
	const csKeys = flattenLeafKeys(csLocale);
	const enKeysSet = toSet(enKeys);
	const csKeysSet = toSet(csKeys);
	const enOnly = diff(enKeys, csKeysSet);
	const csOnly = diff(csKeys, enKeysSet);
	if (enOnly.length > 0 || csOnly.length > 0) {
		if (enOnly.length > 0) {
			errors.push(`${namespace}: keys missing in cs: ${formatSample(enOnly)}`);
		}
		if (csOnly.length > 0) {
			errors.push(`${namespace}: keys missing in en: ${formatSample(csOnly)}`);
		}
	}
}

if (errors.length > 0) {
	console.error("Locale validation failed:");
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

let totalLeafKeys = 0;
for (const namespace of namespaceUniverse) {
	const enLocale = await loadLocale("en", namespace);
	totalLeafKeys += flattenLeafKeys(enLocale).length;
}

console.log("Locale validation passed.");
console.log(
	`Namespaces: ${namespaceUniverse.length}, EN/CS leaf keys: ${totalLeafKeys}`,
);
