import { expect, type Page } from "@playwright/test";
import type {
	CatalogScenarioInput,
	CatalogScenarioResult,
} from "@/lib/testing/e2e-types";

export const openHarness = async (page: Page) => {
	await page.goto("/e2e");
	await expect(page.getByTestId("e2e-status")).toHaveText("status:ready");
};

export const resetBrowserState = async (page: Page) => {
	await openHarness(page);

	await page.evaluate(async () => {
		if (!window.__finitoE2E) {
			throw new Error("E2E harness is not available.");
		}

		await window.__finitoE2E.resetBrowserState();
	});
};

export const bootstrapE2EAuth = async (page: Page) => {
	await resetBrowserState(page);

	return await page.evaluate(async () => {
		if (!window.__finitoE2E) {
			throw new Error("E2E harness is not available.");
		}

		return await window.__finitoE2E.bootstrap();
	});
};

export const seedCatalog = async (
	page: Page,
	scenario: CatalogScenarioInput,
): Promise<CatalogScenarioResult> => {
	await resetBrowserState(page);

	return await page.evaluate(async (inputScenario) => {
		if (!window.__finitoE2E) {
			throw new Error("E2E harness is not available.");
		}

		return await window.__finitoE2E.runScenario("catalog", inputScenario);
	}, scenario);
};
