import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
	expect,
	test as base,
	type Page,
} from "@playwright/test";
import type {
	CatalogScenarioInput,
	CatalogScenarioResult,
	E2EScenarioContext,
	E2EWorkerContext,
} from "@/lib/testing/e2e-types";
import { baseURL } from "../playwright.config";
import { bootstrapE2EAuth, resetBrowserState, runScenario } from "./helpers/harness";

type E2EWorkerFixtures = {
	workerContext: E2EWorkerContext;
	workerStorageState: string;
};

type E2ETestFixtures = {
	scenarioContext: E2EScenarioContext;
	harness: {
		resetBrowserState: () => Promise<void>;
		bootstrapAuth: () => Promise<{
			deviceId: string;
			mnemonic: string;
		}>;
		runScenario: <TName extends keyof import("@/lib/testing/e2e-types").E2EScenarioInputMap>(
			name: TName,
			input: import("@/lib/testing/e2e-types").E2EScenarioInputMap[TName],
		) => Promise<
			import("@/lib/testing/e2e-types").E2EScenarioResultMap[TName]
		>;
		seedCatalog: (
			input: CatalogScenarioInput,
		) => Promise<CatalogScenarioResult>;
		page: Page;
	};
};

export const test = base.extend<E2ETestFixtures, E2EWorkerFixtures>({
	workerContext: [
		async ({}, use, workerInfo) => {
			await use({
				workerId: `worker-${workerInfo.parallelIndex}`,
				deviceKey: `e2e-device-${workerInfo.parallelIndex}`,
			});
		},
		{ scope: "worker" },
	],
	workerStorageState: [
		async ({ browser, workerContext }, use, workerInfo) => {
			const authDir = path.join("e2e", ".auth");
			const authFile = path.join(authDir, `admin-${workerInfo.parallelIndex}.json`);
			await mkdir(authDir, { recursive: true });

			const context = await browser.newContext({
				baseURL,
			});
			const page = await context.newPage();
			await bootstrapE2EAuth(page, workerContext);
			await context.storageState({
				path: authFile,
				indexedDB: true,
			});
			await context.close();

			await use(authFile);
		},
		{ scope: "worker" },
	],
	storageState: async ({ workerStorageState }, use) => {
		await use(workerStorageState);
	},
	scenarioContext: async ({ workerContext }, use, testInfo) => {
		await use({
			...workerContext,
			testId: testInfo.testId,
		});
	},
	harness: async ({ page, scenarioContext, workerContext }, use) => {
		await use({
			page,
			resetBrowserState: async () => {
				await resetBrowserState(page);
			},
			bootstrapAuth: async () => {
				return await bootstrapE2EAuth(page, workerContext);
			},
			runScenario: async (name, input) =>
				await runScenario(page, name, input, scenarioContext),
			seedCatalog: async (input) =>
				await runScenario(page, "catalog", input, scenarioContext),
		});
	},
});

export { expect };
