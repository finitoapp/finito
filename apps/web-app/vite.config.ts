import path from "node:path"

import { sentryVitePlugin } from "@sentry/vite-plugin"
import { createEnv } from "@t3-oss/env-core"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import basicSsl from "@vitejs/plugin-basic-ssl"
import react from "@vitejs/plugin-react"
import { type ConfigEnv, loadEnv, type PluginOption } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import type { ViteUserConfigFnObject } from "vitest/config"
import { defaultExclude } from "vitest/config"
import { z } from "zod"

import { getAppVersion, readRepoSnapshot } from "../../bin/app-build.ts"
import { guestSparkEndpoints } from "../../packages/core/src/spark/spark-guest-endpoints.ts"
import { isAndroidWebView } from "./src/platform/runtime.ts"
import { installOneTabLocks } from "./src/polyfills/one-tab-locks.ts"

/** A build switch: on only when set to exactly "1". */
const BuildFlagSchema = z
  .string()
  .optional()
  .transform((value) => value === "1")

const repositoryRoot = path.resolve(import.meta.dirname, "../..")

const loadBuildEnv = (mode: string) =>
  createEnv({
    server: {
      PAYKY_LANDING_ORIGIN: z.url().default("http://127.0.0.1:5175"),
      // `bun run cap:sync`'s build for the native app.
      PAYKY_CAPACITOR_BUILD: BuildFlagSchema,
      // Turns the dev server's self-signed HTTPS off, for Android live reload.
      PAYKY_DISABLE_BASIC_SSL: BuildFlagSchema,
      // `bun run test:e2e:preview`'s one-off build, see `__E2E_TEST_BUILD__`.
      PAYKY_E2E_BUILD: BuildFlagSchema,
      // Source map upload; unset skips it (see `.env.example`).
      SENTRY_AUTH_TOKEN: z.string().optional(),
      SENTRY_ORG: z.string().optional(),
      SENTRY_PROJECT: z.string().optional(),
    },
    runtimeEnv: { ...loadEnv(mode, repositoryRoot, ""), ...process.env },
    emptyStringAsUndefined: true,
  })

/**
 * Evolu's workers get the same lock fix as the main thread
 * (`src/polyfills/one-tab-locks.ts`), from the same source: both
 * functions are self-contained, so their source text runs as is. The workers
 * have no Capacitor to ask, so the user agent alone decides there.
 */
// Wrapped, so its names cannot meet the worker chunk's own top-level ones.
const evoluAndroidWebViewWorkerLocksShim = `(() => {
${isAndroidWebView}
if (isAndroidWebView()) (${installOneTabLocks})();
})();
`

function evoluAndroidWebViewWorkerLocksPlugin(): PluginOption {
  return {
    name: "payky-evolu-android-webview-worker-locks",
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== "chunk") continue
        if (
          !item.fileName.startsWith("assets/Shared.worker-") &&
          !item.fileName.startsWith("assets/Db.worker-")
        ) {
          continue
        }

        item.code = `${evoluAndroidWebViewWorkerLocksShim}\n${item.code}`
      }
    },
  }
}

/** Serves the snapshot in development and emits it with the web build. */
function repoSnapshotPlugin(): PluginOption {
  return {
    name: "payky-repo-snapshot",
    configureServer(server) {
      server.middlewares.use("/repo-snapshot.json", (_request, response) => {
        response.setHeader("content-type", "application/json")
        response.end(readRepoSnapshot())
      })
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "repo-snapshot.json",
        source: readRepoSnapshot(),
      })
    },
  }
}

const createGuestContentSecurityPolicy = (): string =>
  [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' wss: ${guestSparkEndpoints.join(" ")}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")

const rewriteGuestPath = (
  request: { url?: string },
  _response: unknown,
  next: () => void
) => {
  if (request.url === "/t" || request.url?.startsWith("/t?")) {
    request.url = request.url.replace(/^\/t/u, "/t.html")
  }
  next()
}

function guestPagePlugin(): PluginOption {
  return {
    name: "payky-table-self-pay-guest-page",
    configureServer(server) {
      server.middlewares.use(rewriteGuestPath)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteGuestPath)
    },
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (context.server !== undefined || !context.path.endsWith("/t.html")) {
          return html
        }
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content: createGuestContentSecurityPolicy(),
            },
            injectTo: "head-prepend",
          },
        ]
      },
    },
  }
}

function isNativeAndroidWebViewBuild(
  command: string,
  enabled: boolean
): boolean {
  return command === "build" && enabled
}

// https://vite.dev/config/
export default (({ command, isSsrBuild, mode }: ConfigEnv) => {
  const buildEnv = loadBuildEnv(mode)
  const useAndroidWebViewWorkerLocksPlugin = isNativeAndroidWebViewBuild(
    command,
    buildEnv.PAYKY_CAPACITOR_BUILD
  )
  const isCapacitorBuild = buildEnv.PAYKY_CAPACITOR_BUILD
  const useBasicSsl = !buildEnv.PAYKY_DISABLE_BASIC_SSL
  const sentryAuthToken = buildEnv.SENTRY_AUTH_TOKEN
  const useSentryVitePlugin =
    command === "build" && !isSsrBuild && Boolean(sentryAuthToken)
  const appVersion = getAppVersion()

  const landingProxy = {
    "/landing": { target: buildEnv.PAYKY_LANDING_ORIGIN, ws: true },
    "/sitemap.xml": {
      target: buildEnv.PAYKY_LANDING_ORIGIN,
      rewrite: () => "/landing/sitemap.xml",
    },
  }

  return {
    server: { proxy: landingProxy },
    preview: { proxy: landingProxy },
    envDir: repositoryRoot,
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      // Keeps the e2e seed bridge (src/components/e2e-test-bridge.tsx) alive
      // in the one production build `bun run test:e2e:preview` produces, since
      // `import.meta.env.DEV` is false in every `vite build` output
      // regardless of how it's later served. Real production builds never
      // set PAYKY_E2E_BUILD, so this stays false (and the bridge dead code)
      // for anything actually shipped.
      __E2E_TEST_BUILD__: JSON.stringify(buildEnv.PAYKY_E2E_BUILD),
    },
    build: {
      sourcemap: useSentryVitePlugin,
      ...(isCapacitorBuild
        ? {}
        : {
            rolldownOptions: {
              input: {
                main: path.resolve(import.meta.dirname, "index.html"),
                guest: path.resolve(import.meta.dirname, "t.html"),
              },
            },
          }),
    },
    plugins: [
      ...(useBasicSsl ? [basicSsl()] : []),
      ...(useAndroidWebViewWorkerLocksPlugin
        ? [evoluAndroidWebViewWorkerLocksPlugin()]
        : []),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
      guestPagePlugin(),
      // The native app reads payky.me's snapshot instead of carrying one.
      ...(isCapacitorBuild ? [] : [repoSnapshotPlugin()]),
      VitePWA({
        registerType: "prompt",
        injectRegister: "auto",
        // The native app ships its assets in the APK, so a service worker only
        // gets in the way: its precache survives an APK update and serves the
        // old bundle until the update toast is accepted. The self-destroying
        // worker replaces one already installed, clears it and reloads once.
        selfDestroying: isCapacitorBuild,
        manifest: false,
        workbox: {
          cleanupOutdatedCaches: true,
          // `wasm` too: the SQLite binary is a hashed asset the bundled worker
          // fetches at start, and a deploy removes the old one from the
          // server. A precache without it opens the installed app on a 404.
          globPatterns: ["**/*.{css,html,js,png,svg,wasm,webmanifest,woff2}"],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          navigateFallback: "/index.html",
          // The landing pages are served as they were prerendered, never
          // replaced by the app's shell or kept in its precache. Files
          // (sitemap.xml, robots.txt) and server routes go to the network
          // too, mirroring the SPA rewrite in vercel.json.
          navigateFallbackDenylist: [
            /^\/landing(?:\/|$)/u,
            /^\/(?:api|\.well-known)\//u,
            /\/[^/]+\.[^/]+$/u,
            /^\/t$/u,
          ],
          globIgnores: [
            "landing*.html",
            "landing/og-*.png",
            "t.html",
            "assets/guest-*.js",
          ],
        },
      }),
      ...(useSentryVitePlugin
        ? [
            sentryVitePlugin({
              org: buildEnv.SENTRY_ORG,
              project: buildEnv.SENTRY_PROJECT,
              authToken: sentryAuthToken,
              release: { name: appVersion },
              sourcemaps: {
                filesToDeleteAfterUpload: ["**/*.js.map"],
              },
            }),
          ]
        : []),
    ],
    worker: {
      plugins: () =>
        useAndroidWebViewWorkerLocksPlugin
          ? [evoluAndroidWebViewWorkerLocksPlugin()]
          : [],
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    optimizeDeps: {
      exclude: ["@evolu/web", "@evolu/react-web", "@evolu/common"],
    },
    test: {
      name: "web",
      root: import.meta.dirname,
      exclude: [...defaultExclude, "e2e/**"],
      setupFiles: ["../../packages/core/src/testing/setup.ts"],
      // The same zone `playwright.config.ts` pins, so a formatted date means
      // the same thing in both suites and on a developer machine that is not
      // in UTC. Without it the date formatters can only be asserted against
      // whatever zone the runner happens to sit in.
      env: { TZ: "Europe/Prague" },
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "lcov"],
        reportsDirectory: "coverage",
        // Without `include`, Vitest reports only the modules some test
        // already imports, so every file with no test at all is simply
        // absent and adding one *raises* the percentage. Naming the sources
        // makes the number mean "of the code we ship" instead.
        include: ["src/**/*.{ts,tsx}", "api/**/*.ts"],
        // This version defaults `exclude` to `[]`, so everything that is not
        // shipped application code has to be listed here.
        exclude: [
          "**/*.test.{ts,tsx}",
          "**/*.d.ts",
          "src/test/**",
          "**/*-test-fixtures.ts",
          // Vendored as upstream ships them and never reviewed here; see
          // AGENTS.md.
          "src/components/ui/**",
          "src/components/reui/**",
          // Generated by the TanStack Router plugin.
          "src/routeTree.gen.ts",
        ],
      },
    },
  }
}) as ViteUserConfigFnObject
