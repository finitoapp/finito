"use client";

import { atom, useAtomValue, useStore } from "jotai";
import { useEffect } from "react";

const hashAtomNumber = atom(0);
const hashAtom = atom<string | null>(null);

let shutdown = () => {};

const resolveHash = () => {
	const [hash, ...rest] = decodeURIComponent(window.location.hash)
		.replace(/^#/, "")
		.split("#");

	if (rest.length === 0) {
		return hash === "" ? null : hash;
	}

	return rest.join("#");
};

export const useHash = () => {
	const store = useStore();
	const hash = useAtomValue(hashAtom) ?? resolveHash();

	useEffect(() => {
		const currentValue = store.get(hashAtomNumber);
		store.set(hashAtomNumber, currentValue + 1);
		if (currentValue === 0) {
			const { pushState, replaceState } = window.history;
			window.history.pushState = (...args) => {
				pushState.apply(window.history, args);
				setTimeout(() =>
					store.set(
						hashAtom,
						window.location.hash !== "" ? resolveHash() : null,
					),
				);
			};
			window.history.replaceState = (...args) => {
				replaceState.apply(window.history, args);
				setTimeout(() =>
					store.set(
						hashAtom,
						window.location.hash !== "" ? resolveHash() : null,
					),
				);
			};
			const onChange = () => {
				store.set(hashAtom, window.location.hash !== "" ? resolveHash() : null);
			};
			window.addEventListener("hashchange", onChange);

			shutdown = () => {
				window.removeEventListener("hashchange", onChange);
				window.history.pushState = pushState;
				window.history.replaceState = replaceState;
			};
		}

		return () => {
			const currentValue = store.get(hashAtomNumber);
			store.set(hashAtomNumber, currentValue - 1);
			if (currentValue === 1) {
				shutdown();
				shutdown = () => {};
			}
		};
	}, [store.set, store.get]);

	return hash;
};
