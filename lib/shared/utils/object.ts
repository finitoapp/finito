"use client";

import type { Paths, SimplifyDeep } from "type-fest";

export type UnflattenOutput<T extends Record<string, unknown>> = BuildNested<
	T,
	Paths<T> & string
>;

// Rekurzivní builder nested objektu
type BuildNested<
	T extends Record<string, unknown>,
	AllPaths extends string,
	Prefix extends string = "",
> = {
	[K in ExtractKeyAfterPrefix<
		AllPaths,
		Prefix
	> as CleanKey<K>]: // Je to listový klíč (bez další tečky)?
	`${Prefix}${K}` extends AllPaths
		? ValueAtExactPath<T, `${Prefix}${K}`>
		: // Nebo má další segmenty → rekurze
			BuildNested<T, AllPaths, `${Prefix}${K}.`>;
};

// Pomocné typy
type ExtractKeyAfterPrefix<
	Paths extends string,
	Prefix extends string,
> = Paths extends `${Prefix}${infer Rest}`
	? Rest extends `${infer Head}.${string}`
		? Head
		: Rest extends `${infer Head}`
			? Head
			: never
	: never;

type CleanKey<K extends string> = K extends `${infer Head}.${string}`
	? Head
	: K;

type ValueAtExactPath<T, P extends string> = P extends keyof T
	? Exclude<T[P], null | undefined>
	: P extends `${infer Head}.${infer Rest}`
		? Head extends keyof T
			? ValueAtExactPath<T[Head], Rest>
			: never
		: never;

type R = SimplifyDeep<
	UnflattenOutput<{
		foo: "abc";
		bar: number;
		"a.b": 123;
		b: null;
		"b.c": 456;
	}>
>;

export function nestObjectSkipNullBranches<T extends Record<string, any>>(
	flat: T,
): SimplifyDeep<UnflattenOutput<T>> {
	const result: UnflattenOutput<T> = {};

	// Nejprve si posbíráme všechny cesty a jejich hodnoty
	const entries = Object.entries(flat);

	for (const [path, value] of entries) {
		if (value === undefined) continue;

		const parts = path.split(".");
		if (parts.length === 0) continue;

		let current = result;

		// Vytvoření mezilehlých úrovní
		for (let i = 0; i < parts.length - 1; i++) {
			const key = parts[i];

			// Vytvoření mezilehlého objektu (pokud tam ještě nic není nebo tam není objekt)
			if (
				!(key in current) ||
				current[key] == null ||
				typeof current[key] !== "object"
			) {
				current[key] = {};
			}

			current = current[key] as NestedObject;
		}

		const lastKey = parts[parts.length - 1];

		// Pokud už na tomto místě něco je (např. objekt z předchozích cest),
		// a aktuální hodnota je null, tak ji ignorujeme (ponecháme objekt).
		// Pokud je aktuální hodnota ne-null, tak přepíšeme to, co tam je.
		const hasDescendants = entries.some(
			([otherPath]) => otherPath !== path && otherPath.startsWith(`${path}.`),
		);

		if (value === null && hasDescendants) {
			// Pokud je hodnota null a má potomky, tak tento null ignorujeme,
			// protože potomci jej buď už přepsali na objekt, nebo jej přepíší později.
			if (!(lastKey in current)) {
				current[lastKey] = {};
			}
		} else {
			// Normální nastavení hodnoty (přepíše případný dříve vytvořený prázdný objekt)
			current[lastKey] = value;
		}
	}

	// Druhý průchod – vyčištění prázdných objektů
	function clean(obj: NestedObject): void {
		for (const key in obj) {
			if (obj[key] !== null && typeof obj[key] === "object") {
				clean(obj[key] as NestedObject);
				// Pokud po vyčištění zůstal prázdný objekt → smažeme i ten
				if (Object.keys(obj[key] as object).length === 0) {
					delete obj[key];
				}
			}
		}
	}

	clean(result);

	return result;
}
