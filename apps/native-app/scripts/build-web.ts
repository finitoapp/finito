import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createEnv } from "@t3-oss/env-core"
import { $ } from "bun"
import { z } from "zod"
import { getAppVersion, readRepoSnapshot } from "../../../bin/app-build.ts"
import appConfig from "../app.config.ts"
import { appChannels, appTitle } from "../src/core/app-title.cjs"
import {
  retitleIndexHtml,
  retitleWebManifest,
} from "../src/core/web-export-title.ts"

/**
 * The Finito PWA as the `finito` and `finito-edge` Vercel projects serve it
 * (docs/finito-deployment.md): Expo's web export, stamped with the build's
 * version, named after its channel (brand/0005), and the repository snapshot
 * the assistant reads (ai/0003), which the Android app fetches from the same
 * origin.
 */
const buildEnv = createEnv({
  server: {
    // Set per Vercel project and environment. Unset, a build is `dev`, so
    // plain "Finito" is only ever shipped on purpose.
    PAYKY_APP_CHANNEL: z.enum(appChannels).default("dev"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

const appDir = path.resolve(import.meta.dirname, "..")
const outDir = path.join(appDir, "dist")

const rewrite = (file: string, change: (text: string) => string): void => {
  const filePath = path.join(outDir, file)
  writeFileSync(filePath, change(readFileSync(filePath, "utf8")))
}

// `--clear`: Metro caches the inlined app config, version included.
await $`bun x expo export --platform web --clear --output-dir ${outDir}`
  .cwd(appDir)
  .env({ ...process.env, PAYKY_APP_VERSION: getAppVersion() })
const title = appTitle(appConfig.name, buildEnv.PAYKY_APP_CHANNEL)
rewrite("index.html", (html) => retitleIndexHtml(html, title))
rewrite("manifest.webmanifest", (text) => retitleWebManifest(text, title))
writeFileSync(path.join(outDir, "repo-snapshot.json"), readRepoSnapshot())
