import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;
const authFile = "e2e/.auth/admin.json";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "setup",
			testMatch: /.*\.setup\.ts/,
		},
		{
			name: "chromium",
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: authFile,
			},
		},
	],
	webServer: externalBaseURL
		? undefined
		: {
				command: "bun run e2e:serve",
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 240_000,
			},
});

export { authFile, baseURL };
