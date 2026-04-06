import type { FinitoE2EHarness } from "@/lib/testing/e2e-types";

declare global {
	interface Window {
		__finitoE2E?: FinitoE2EHarness;
	}
}

export {};
