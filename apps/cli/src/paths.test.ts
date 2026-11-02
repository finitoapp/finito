import { resolve } from "node:path"
import { describe, expect, test } from "vitest"
import { repositoryRoot, resolveDataDir } from "./paths.ts"

describe("CLI data directory", () => {
  test("defaults to the repository's .data regardless of cwd", () => {
    expect(resolveDataDir(undefined, "/tmp")).toBe(
      resolve(repositoryRoot, ".data")
    )
  })
  test("resolves an explicit relative path against the caller cwd", () => {
    expect(resolveDataDir("custom", "/tmp/payky")).toBe("/tmp/payky/custom")
    expect(resolveDataDir("/tmp/absolute", repositoryRoot)).toBe(
      "/tmp/absolute"
    )
  })
})
