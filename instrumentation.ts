import { ensureDisposableStackPolyfill } from "@/lib/polyfills/disposable-stack";

export async function register() {
	await ensureDisposableStackPolyfill();
}
