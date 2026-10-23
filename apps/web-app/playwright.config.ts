import { defineConfig, devices } from "@playwright/test"
import { fakeEetProductionUrl } from "./e2e/support/eet-endpoints.ts"
import { pageHeight, pageWidth } from "./e2e/support/viewport.ts"

const e2ePort = 5174
const baseURL = `https://127.0.0.1:${e2ePort}`

// PAYKY_E2E_SERVER=preview runs against a production build already built by
// `bun run test:e2e:preview` (`vite build` once, then `vite preview` to serve
// it), instead of the dev server. basic-ssl still applies to `vite preview`
// (see vite.config.ts), so this stays over HTTPS like the default dev-server
// run.
const useProductionBuild = process.env.PAYKY_E2E_SERVER === "preview"
const webServerCommand = useProductionBuild
  ? `vite preview --host 127.0.0.1 --port ${e2ePort} --strictPort`
  : `bun run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // One Vite dev server serves every worker. Playwright's default of half
  // the cores (8 on a 16-core machine) overloads it until tests time out;
  // 4 runs the whole suite clean. CI keeps the default on its smaller
  // runner and a production build.
  workers: process.env.CI ? undefined : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : "html",
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    locale: "en-US",
    timezoneId: "Europe/Prague",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: pageWidth, height: pageHeight },
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    {
      name: "chromium",
      // The phone-sized viewport after the spread: the device preset's own
      // 1280×720 would otherwise win and put every spec in the large-monitor
      // layout (`lg`), which the specs are not written for.
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: pageWidth, height: pageHeight },
      },
    },
  ],
  webServer: [
    {
      command: useProductionBuild
        ? "bun run --cwd ../landing preview"
        : "bun run --cwd ../landing dev",
      url: "http://127.0.0.1:5175/landing",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: webServerCommand,
      env: {
        VITE_PAYKY_EET_PRODUCTION_URL: fakeEetProductionUrl,
        VITE_PAYKY_SELF_PAY_ORIGIN: baseURL,
      },
      url: baseURL,
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
