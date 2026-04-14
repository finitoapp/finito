type ExplicitResourceGlobals = typeof globalThis & {
	AsyncDisposableStack?: unknown;
	DisposableStack?: unknown;
	SuppressedError?: unknown;
};

const explicitResourceGlobals = globalThis as ExplicitResourceGlobals;

const hasExplicitResourceManagementSupport =
	typeof explicitResourceGlobals.DisposableStack === "function" &&
	typeof explicitResourceGlobals.AsyncDisposableStack === "function" &&
	typeof explicitResourceGlobals.SuppressedError === "function" &&
	typeof Symbol.dispose === "symbol" &&
	typeof Symbol.asyncDispose === "symbol";

export async function ensureDisposableStackPolyfill() {
	if (hasExplicitResourceManagementSupport) {
		return;
	}

	await import("core-js/proposals/explicit-resource-management");
}
