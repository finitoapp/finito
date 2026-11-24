import { ok, type Task } from "@evolu/common"
import { z } from "zod"
import {
  appFetchAsJson,
  type FetchDep,
  type FetchError,
  validateJsonResponse,
} from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { DeviceLanguage } from "../../evolu/device-client.ts"

/**
 * Open Food Facts first, then its drugstore sibling — same API, separate
 * databases. Both send `Access-Control-Allow-Origin: *`, so the browser can
 * call them directly without a proxy or an API key.
 */
const openFactsSources = [
  { name: "Open Food Facts", baseUrl: "https://world.openfoodfacts.org" },
  { name: "Open Beauty Facts", baseUrl: "https://world.openbeautyfacts.org" },
] as const

export interface OpenFactsProduct {
  readonly name: string
  readonly description: string | null
  /** Shown next to the prefilled fields; ODbL requires the attribution. */
  readonly source: (typeof openFactsSources)[number]["name"]
}

const OpenFactsProductResponseSchema = z.object({
  status: z.literal(1),
  product: z.object({
    product_name: z.string().optional(),
    product_name_cs: z.string().optional(),
    product_name_en: z.string().optional(),
    product_name_sk: z.string().optional(),
    product_name_vi: z.string().optional(),
    brands: z.string().optional(),
    quantity: z.string().optional(),
  }),
})

const createOpenFactsHttpError = defineError("OpenFactsHttpError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
}>()
export type OpenFactsHttpError = ReturnType<typeof createOpenFactsHttpError>

const createOpenFactsApiError = defineError("OpenFactsApiError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
  readonly cause?: unknown
}>()
export type OpenFactsApiError = ReturnType<typeof createOpenFactsApiError>

/**
 * True for EAN-8, UPC-A and EAN-13 codes with a valid check digit — the
 * retail barcodes these databases index. Anything else (QR payloads, a
 * merchant's own internal codes) must never leave the device.
 */
export const isRetailBarcode = (code: string): boolean => {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false

  const digits = [...code].map(Number).reverse()
  const sum = digits
    .slice(1)
    .reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
      0
    )

  return (10 - (sum % 10)) % 10 === digits[0]
}

const nonBlank = (value: string | undefined): string | undefined =>
  value?.trim() || undefined

/** Evolu stores names and descriptions as `NonEmptyString255`. */
const truncate255 = (value: string): string => value.slice(0, 255)

/**
 * Looks a retail barcode up in the Open Facts databases. A product neither
 * database knows (HTTP 404, `status: 0`), or one without a name, is `null` —
 * an expected outcome, not an error.
 */
export const lookupOpenFactsProduct =
  ({
    code,
    language,
  }: {
    readonly code: string
    readonly language: DeviceLanguage
  }): Task<
    OpenFactsProduct | null,
    OpenFactsHttpError | OpenFactsApiError | FetchError,
    FetchDep
  > =>
  async (run) => {
    for (const source of openFactsSources) {
      const url = new URL(`/api/v2/product/${code}.json`, source.baseUrl)
      url.searchParams.set(
        "fields",
        `product_name,product_name_${language},brands,quantity`
      )

      const response = await run(appFetchAsJson(url))
      if (!response.ok) return response
      if (response.value.status === 404) continue

      const result = validateJsonResponse(response.value, {
        schema: OpenFactsProductResponseSchema,
        onHttpError: ({ status, responseBody }) =>
          createOpenFactsHttpError({
            message: `${source.name} product request failed: ${status}`,
            status,
            responseBody,
          }),
        onResponseError: ({ status, responseBody, cause }) =>
          createOpenFactsApiError({
            message: `Invalid ${source.name} product response.`,
            status,
            responseBody,
            cause,
          }),
      })
      if (!result.ok) return result

      const { product } = result.value
      const name =
        nonBlank(product[`product_name_${language}`]) ??
        nonBlank(product.product_name)
      if (name === undefined) continue

      const brand = nonBlank(product.brands?.split(",")[0])
      const description = [brand, nonBlank(product.quantity)]
        .filter((part) => part !== undefined)
        .join(", ")

      return ok({
        name: truncate255(name),
        description: description === "" ? null : truncate255(description),
        source: source.name,
      })
    }

    return ok(null)
  }
