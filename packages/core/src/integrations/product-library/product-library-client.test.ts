import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { FetchDep } from "../../deps.ts"
import { testProductLibrary } from "../../testing/product-library.ts"
import {
  createProductLibraryDep,
  libraryImageUrl,
  loadProductLibrary,
  type ProductLibraryApiError,
  type ProductLibraryDep,
  type ProductLibraryHttpError,
} from "./product-library-client.ts"

const inputToString = (input: RequestInfo | URL): string =>
  input instanceof URL ? input.toString() : String(input)

const createDeps = (
  respond: () => Response,
  requestedUrls: string[] = [],
  baseUrl = "https://library.test"
) =>
  ({
    ...createProductLibraryDep({ baseUrl }),
    fetch: async (input) => {
      requestedUrls.push(inputToString(input))
      return respond()
    },
  }) satisfies ProductLibraryDep & FetchDep

describe("loadProductLibrary", () => {
  test("downloads the whole library from v1/library.json", async () => {
    const requestedUrls: string[] = []
    await using run = testCreateRun(
      createDeps(() => Response.json(testProductLibrary), requestedUrls)
    )

    await expect(run(loadProductLibrary())).resolves.toEqual({
      ok: true,
      value: testProductLibrary,
    })
    expect(requestedUrls).toEqual(["https://library.test/v1/library.json"])
  })

  test("keeps a base URL's path prefix", async () => {
    const requestedUrls: string[] = []
    await using run = testCreateRun(
      createDeps(
        () => Response.json(testProductLibrary),
        requestedUrls,
        "https://cdn.test/product-library/"
      )
    )

    await run(loadProductLibrary())

    expect(requestedUrls).toEqual([
      "https://cdn.test/product-library/v1/library.json",
    ])
  })

  test("ignores fields, languages and countries it does not know", async () => {
    const [espresso, ...others] = testProductLibrary.products
    await using run = testCreateRun(
      createDeps(() =>
        Response.json({
          ...testProductLibrary,
          publishedAt: "2026-11-16",
          products: [
            {
              ...espresso,
              names: { ...espresso?.names, de: "Espresso" },
              synonyms: { ...espresso?.synonyms, de: ["Kaffee"] },
              vat: { ...espresso?.vat, AT: 1000 },
              allergens: ["milk"],
            },
            ...others,
          ],
        })
      )
    )

    await expect(run(loadProductLibrary())).resolves.toEqual({
      ok: true,
      value: testProductLibrary,
    })
  })

  test("returns a typed error for a failed request", async () => {
    await using run = testCreateRun(
      createDeps(() => new Response("Not found", { status: 404 }))
    )

    await expect(run(loadProductLibrary())).resolves.toMatchObject({
      ok: false,
      error: {
        type: "ProductLibraryHttpError",
        status: 404,
        responseBody: "Not found",
      } satisfies Partial<ProductLibraryHttpError>,
    })
  })

  test("returns a typed error for a library that breaks the contract", async () => {
    const body = JSON.stringify({ ...testProductLibrary, products: "none" })
    await using run = testCreateRun(createDeps(() => new Response(body)))

    await expect(run(loadProductLibrary())).resolves.toMatchObject({
      ok: false,
      error: {
        type: "ProductLibraryApiError",
        status: 200,
        responseBody: body,
      } satisfies Partial<ProductLibraryApiError>,
    })
  })
})

describe("libraryImageUrl", () => {
  const base = {
    baseUrl: "https://library.test/",
    imageSizes: [512, 256],
    image: "espresso.3f9a2c",
  }

  test("picks the smallest published size at least as large as asked", () => {
    expect(libraryImageUrl({ ...base, size: 96 })).toBe(
      "https://library.test/v1/img/espresso.3f9a2c-256.webp"
    )
    expect(libraryImageUrl({ ...base, size: 300 })).toBe(
      "https://library.test/v1/img/espresso.3f9a2c-512.webp"
    )
  })

  test("falls back to the largest size when none is large enough", () => {
    expect(libraryImageUrl({ ...base, size: 1024 })).toBe(
      "https://library.test/v1/img/espresso.3f9a2c-512.webp"
    )
  })

  test("has no URL when the library publishes no sizes", () => {
    expect(
      libraryImageUrl({ ...base, imageSizes: [], size: 256 })
    ).toBeUndefined()
  })
})
