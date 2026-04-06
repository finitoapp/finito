import { mkdir } from "node:fs/promises";
import { test as setup } from "@playwright/test";
import { authFile } from "../../playwright.config";
import { bootstrapE2EAuth } from "../helpers/harness";

setup("bootstrap e2e auth state", async ({ page }) => {
	await mkdir("e2e/.auth", { recursive: true });
	await bootstrapE2EAuth(page);
	await page.context().storageState({
		path: authFile,
		indexedDB: true,
	});
});
