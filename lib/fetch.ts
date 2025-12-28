import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const universalFetch = isTauri() ? tauriFetch : fetch;
