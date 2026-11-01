import { writeFileSync } from "node:fs"
import path from "node:path"
import { $ } from "bun"
import { getAppVersion, readRepoSnapshot } from "../../../bin/app-build.ts"

/**
 * The Finito PWA as the `finito` and `finito-edge` Vercel projects serve it
 * (docs/finito-deployment.md): Expo's web export, stamped with the build's
 * version, and the repository snapshot the assistant reads (ai/0003), which
 * the Android app fetches from the same origin.
 */
const appDir = path.resolve(import.meta.dirname, "..")
const outDir = path.join(appDir, "dist")

// `--clear`: Metro caches the inlined app config, version included.
await $`bun x expo export --platform web --clear --output-dir ${outDir}`
  .cwd(appDir)
  .env({ ...process.env, PAYKY_APP_VERSION: getAppVersion() })
writeFileSync(path.join(outDir, "repo-snapshot.json"), readRepoSnapshot())
