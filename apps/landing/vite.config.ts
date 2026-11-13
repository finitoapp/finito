import path from "node:path"
import { createEnv } from "@t3-oss/env-core"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { loadEnv, type PluginOption } from "vite"
import { defineConfig } from "vitest/config"
import { z } from "zod"

/**
 * The landing page is its own document, prerendered once per language by
 * `scripts/prerender-landing.ts` (landing/0002). These middlewares give the dev
 * and preview servers the addresses `vercel.json` gives production: the dev
 * server serves the unrendered template, which renders in the browser, and
 * the preview server serves the prerendered file for the address's
 * language, Czech at `/landing`, or at the root as Finito's (landing/0013).
 */
function landingPagesPlugin(brand: LandingBrand): PluginOption {
  // The EET page (landing/0006), the page on how the app works (landing/0008)
  // and the privacy policy (landing/0014) have a file of their own per
  // language, and on Finito's landing the card terminal documentation
  // (landing/0015), which Payky's does not serve.
  const documentFiles: Record<string, string> = {
    "eet-2-0": "-eet",
    "jak-to-funguje": "-tech",
    privacy: "-privacy",
    ...(brand === "finito" ? { terminal: "-terminal" } : {}),
  }
  const landingPath = new RegExp(
    `^(?:/landing)?(?:/([a-z]{2}))?(?:/(${Object.keys(documentFiles).join("|")}))?/?(?:\\?.*)?$`,
    "u"
  )
  return {
    name: "payky-landing-pages",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url !== undefined && landingPath.test(request.url)) {
          request.url = "/landing/landing.html"
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const match = request.url?.match(landingPath)
        if (match) {
          request.url = `/landing/landing${documentFiles[match[2] ?? ""] ?? ""}-${match[1] ?? "cs"}.html`
        }
        next()
      })
    },
  }
}

/**
 * The prerender writes `sitemap.xml` and `robots.txt` into the build
 * (landing/0002, landing/0013); the dev server has no build, so it renders
 * both on request with the same functions, at the addresses the preview
 * server serves the built files from.
 */
function landingSiteFilesPlugin(): PluginOption {
  const siteFiles: Record<string, "renderSitemap" | "renderRobots"> = {
    "/sitemap.xml": "renderSitemap",
    "/robots.txt": "renderRobots",
  }
  return {
    name: "payky-landing-site-files",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?")[0]?.replace(/^\/landing/u, "")
        const render = pathname === undefined ? undefined : siteFiles[pathname]
        if (render === undefined) {
          next()
          return
        }
        server
          .ssrLoadModule("/src/landing-server.tsx")
          .then(
            (module: Partial<typeof import("./src/landing-server.tsx")>) => {
              const body = module[render]?.()
              if (body === undefined) {
                next()
                return
              }
              response.setHeader(
                "Content-Type",
                render === "renderSitemap"
                  ? "application/xml; charset=utf-8"
                  : "text/plain; charset=utf-8"
              )
              response.end(body)
            }
          )
          .catch(next)
      })
    },
  }
}

/**
 * The brand the config serves, as `src/core/app-env.ts` reads it for the
 * pages (landing/0013), so the dev and preview servers know its documents.
 */
const loadBuildEnv = (mode: string) =>
  createEnv({
    server: {
      PAYKY_LANDING_BRAND: z.enum(["payky", "finito"]).default("payky"),
    },
    runtimeEnv: loadEnv(mode, import.meta.dirname, "PAYKY_LANDING_"),
    emptyStringAsUndefined: true,
  })

type LandingBrand = ReturnType<typeof loadBuildEnv>["PAYKY_LANDING_BRAND"]

export default defineConfig(({ mode }) => ({
  // On finito.fit too, whose pages sit at the root (landing/0013): the assets
  // stay under /landing, which vercel.json maps to the build's root.
  base: "/landing/",
  // `PAYKY_LANDING_BRAND` picks the brand at build time (src/core/app-env.ts).
  envPrefix: ["VITE_", "PAYKY_LANDING_"],
  plugins: [
    react(),
    tailwindcss(),
    landingSiteFilesPlugin(),
    landingPagesPlugin(loadBuildEnv(mode).PAYKY_LANDING_BRAND),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // Its ESM build imports its hooks without file extensions, which Node's
  // loader rejects, so the dev server's SSR load of `landing-server.tsx`
  // (for the sitemap) bundles it instead of handing it to Node.
  ssr: { noExternal: ["@dedalik/use-react"] },
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  preview: { host: "127.0.0.1", port: 5175, strictPort: true },
  build: {
    rolldownOptions: {
      input: path.resolve(import.meta.dirname, "landing.html"),
    },
  },
  test: {
    name: "landing",
    root: import.meta.dirname,
    setupFiles: ["../../packages/core/src/testing/setup.ts"],
  },
}))
