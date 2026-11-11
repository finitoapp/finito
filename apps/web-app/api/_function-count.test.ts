import { readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { describe, expect, test } from "vitest"

/**
 * Vercel deploys every file under a project's `api/` as a serverless function,
 * except one whose name starts with `_` or `.` and what `.vercelignore` leaves
 * out, and the Hobby plan refuses a deployment of more than 12. A new handler
 * passes every other check and only fails at Vercel's deploy step, so count
 * them here, for Payky's project and for Finito's.
 */
const vercelHobbyFunctionLimit = 12

const deployedFunctions = (
  apiDir: string,
  { excludeTests }: { readonly excludeTests: boolean }
): ReadonlyArray<string> =>
  readdirSync(apiDir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(?:ts|js|mjs|cjs)$/u.test(file))
    .filter((file) => !/^[_.]/u.test(basename(file)))
    .filter((file) => !(excludeTests && file.endsWith(".test.ts")))

const webAppDir = join(import.meta.dirname, "..")
const nativeAppDir = join(webAppDir, "..", "native-app")

describe("serverless functions per deployment", () => {
  test("Payky's .vercelignore keeps the api tests out of the deployment", () => {
    const ignored = readFileSync(join(webAppDir, ".vercelignore"), "utf8")
      .split("\n")
      .map((line) => line.trim())

    expect(ignored).toContain("api/**/*.test.ts")
  })

  test("Payky's api/ deploys no more functions than the Hobby plan allows", () => {
    const functions = deployedFunctions(join(webAppDir, "api"), {
      excludeTests: true,
    })

    expect(functions.length).toBeLessThanOrEqual(vercelHobbyFunctionLimit)
  })

  test("Finito's api/ deploys no more functions than the Hobby plan allows", () => {
    const functions = deployedFunctions(join(nativeAppDir, "api"), {
      excludeTests: false,
    })

    expect(functions.length).toBeLessThanOrEqual(vercelHobbyFunctionLimit)
  })
})
