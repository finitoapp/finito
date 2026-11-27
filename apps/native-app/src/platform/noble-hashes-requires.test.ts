import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect, test } from "vitest"

const fromApp = createRequire(import.meta.url)
const fromSpark = createRequire(
  createRequire(
    new URL("../../../../packages/core/package.json", import.meta.url)
  ).resolve("@buildonspark/spark-sdk")
)

/**
 * `metro.config.js` keeps Metro from inlining the requires of the files
 * `metro-noble-hashes.cjs` lists, so the hash rounds of `@noble/hashes` reach
 * their helpers without a `require` per call. A change to Bun's store layout
 * that leaves the Spark SDK's copy off the list fails here first.
 */
test("Metro inlines no require in the Spark SDK's @noble/hashes", () => {
  const files: ReadonlyArray<string> = fromApp("../../metro-noble-hashes.cjs")
  const hashesDir = path.dirname(
    realpathSync(fromSpark.resolve("@noble/hashes/sha2"))
  )
  for (const file of ["sha2.js", "legacy.js", "_md.js", "utils.js"])
    expect(files).toContain(path.join(hashesDir, file))
})
