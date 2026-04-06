import { expect, type Page } from "@playwright/test";
import type {
	E2EScenarioContext,
	E2EWorkerContext,
	CatalogScenarioInput,
	CatalogScenarioResult,
	E2EScenarioInputMap,
	E2EScenarioName,
	E2EScenarioResultMap,
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

export const bootstrapE2EAuth = async (
	page: Page,
	context: E2EWorkerContext,
) => {
	await resetBrowserState(page);

	return await page.evaluate(
		async (workerContext) => {
			if (!window.__finitoE2E) {
				throw new Error("E2E harness is not available.");
			}

			return await window.__finitoE2E.bootstrap(workerContext);
		},
		context,
	);
};

export const runScenario = async <TName extends E2EScenarioName>(
	page: Page,
	name: TName,
	input: E2EScenarioInputMap[TName],
	context: E2EScenarioContext,
): Promise<E2EScenarioResultMap[TName]> => {
	await resetBrowserState(page);

	return await page.evaluate(
		async ({ scenarioName, scenarioInput, scenarioContext }) => {
			if (!window.__finitoE2E) {
				throw new Error("E2E harness is not available.");
			}

			return await window.__finitoE2E.runScenario(
				scenarioName,
				scenarioInput,
				scenarioContext,
			);
		},
		{
			scenarioName: name,
			scenarioInput: input,
			scenarioContext: context,
		},
	);
};

export const seedCatalog = async (
	page: Page,
	scenario: CatalogScenarioInput,
	context: E2EScenarioContext,
): Promise<CatalogScenarioResult> =>
	await runScenario(page, "catalog", scenario, context);
