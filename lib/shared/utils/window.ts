import { isTauri } from "@tauri-apps/api/core";

export const clientBaseUrl = isTauri()
	? `https://finito.netlify.app`
	: `${window.location.protocol}//${window.location.host}`;
