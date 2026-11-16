import { testProductLibrary } from "@payky/core/testing/product-library"
import { beforeEach, expect, test, vi } from "vitest"

const disk = vi.hoisted(() => ({
  files: new Map<string, string>(),
  failWrites: false,
}))

vi.mock("expo-file-system", () => {
  class File {
    readonly uri: string
    constructor(directory: { readonly uri: string }, name: string) {
      this.uri = `${directory.uri}/${name}`
    }
    get exists() {
      return disk.files.has(this.uri)
    }
    create() {
      disk.files.set(this.uri, "")
    }
    textSync() {
      const text = disk.files.get(this.uri)
      if (text === undefined) throw new Error("No such file")
      return text
    }
    async write(text: string) {
      if (disk.failWrites) throw new Error("Disk full")
      disk.files.set(this.uri, text)
    }
  }
  return { File, Paths: { cache: { uri: "file:///cache" } } }
})

const { productLibraryCache } = await import("./product-library-cache.ts")

beforeEach(() => {
  disk.files.clear()
  disk.failWrites = false
})

test("product library cache reads back the library it kept", async () => {
  expect(productLibraryCache.read()).toBeUndefined()

  await productLibraryCache.write(testProductLibrary)

  expect(productLibraryCache.read()).toEqual(testProductLibrary)
})

test("product library cache reads a file that no longer decodes as a miss", () => {
  disk.files.set("file:///cache/product-library-v1.json", "{not json")
  expect(productLibraryCache.read()).toBeUndefined()

  disk.files.set(
    "file:///cache/product-library-v1.json",
    JSON.stringify({ version: "26.11.1" })
  )
  expect(productLibraryCache.read()).toBeUndefined()
})

test("product library cache swallows a failed write and keeps the older copy", async () => {
  await productLibraryCache.write(testProductLibrary)
  disk.failWrites = true

  await expect(
    productLibraryCache.write({ ...testProductLibrary, version: "26.12.1" })
  ).resolves.toBeUndefined()
  expect(productLibraryCache.read()?.version).toBe(testProductLibrary.version)
})
