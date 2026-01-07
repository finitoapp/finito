"use client";

import { useEffect, useEffectEvent, useState } from "react";

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
	const [hash, setHash] = useState(resolveHash());

	const refreshHash = useEffectEvent(() => {
		const newHash = resolveHash();
		if (newHash !== hash) {
			setHash(newHash);
		}
	});

	useEffect(() => {
		const onHashChanged = () => setHash(resolveHash());
		const { pushState, replaceState } = window.history;
		window.history.pushState = (...args) => {
			pushState.apply(window.history, args);
			setTimeout(() => setHash(resolveHash()));
		};
		window.history.replaceState = (...args) => {
			replaceState.apply(window.history, args);
			setTimeout(() => setHash(resolveHash()));
		};
		window.addEventListener("hashchange", onHashChanged);

		refreshHash();

		return () => {
			window.removeEventListener("hashchange", onHashChanged);
		};
	}, []);
	return hash;
};
