import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { createCliEvolu } from "./cli-evolu.ts"

describe("createCliEvolu", () => {
  test("keeps its database readable only by its user, in a directory only its user opens", async () => {
    const directory = mkdtempSync(join(tmpdir(), "payky-cli-evolu-"))
    const fresh = join(directory, "fresh")
    const existing = join(directory, "existing")
    mkdirSync(existing)
    writeFileSync(join(existing, "payky.db"), "", { mode: 0o644 })
    const cwd = process.cwd()
    try {
      {
        await using _cliEvolu = await createCliEvolu(fresh)
        expect(statSync(fresh).mode & 0o777).toBe(0o700)
        expect(statSync(join(fresh, "payky.db")).mode & 0o777).toBe(0o600)
      }
      {
        await using _cliEvolu = await createCliEvolu(existing)
        expect(statSync(join(existing, "payky.db")).mode & 0o777).toBe(0o600)
      }
    } finally {
      process.chdir(cwd)
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
