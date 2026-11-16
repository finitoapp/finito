import type { Task } from "@evolu/common"
import { z } from "zod"
import {
  type FetchDep,
  type FetchError,
  fetchAndValidateJson,
} from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { DeviceLanguage } from "../../evolu/device-client.ts"
import type { CountryCode } from "../../modules/legal-entity/legal-entity-types.ts"

/**
 * A name in every language the apps speak, at most 255 characters as the
 * contract caps it: an item named after it stores a `NonEmptyString255`.
 */
const LocalizedNameSchema = z.object({
  cs: z.string().min(1).max(255),
  sk: z.string().min(1).max(255),
  en: z.string().min(1).max(255),
} satisfies Record<DeviceLanguage, z.ZodType>)

/**
 * The contract's ids are lowercase kebab-case without a length limit; the
 * apps need only one that is there.
 */
const LibraryIdSchema = z.string().min(1)

const SynonymsSchema = z.array(z.string().min(1)).readonly().optional()

/** VAT in hundredths of a percent, the apps' `TaxRatePercentage` unit. */
const VatRateSchema = z.number().int().min(0).max(10000).optional()

/**
 * A picture's `<id>.<hash>`, `null` without one. The contract allows an
 * empty string, which names no picture either, so it reads as `null`.
 */
const LibraryImageSchema = z.codec(
  z.string().nullable(),
  z.string().min(1).nullable(),
  {
    decode: (image) => (image === "" ? null : image),
    encode: (image) => image,
  }
)

const LibraryCategorySchema = z.object({
  id: LibraryIdSchema,
  names: LocalizedNameSchema,
})

const LibraryProductSchema = z.object({
  /**
   * Permanent: a catalog item's `libraryProductId` points at it, which holds
   * at most 255 characters, so a longer one makes the product unusable.
   */
  id: LibraryIdSchema.max(255),
  category: LibraryIdSchema,
  names: LocalizedNameSchema,
  /** Other spellings people type, typos included; matched like names. */
  synonyms: z.object({
    cs: SynonymsSchema,
    sk: SynonymsSchema,
    en: SynonymsSchema,
  } satisfies Record<DeviceLanguage, z.ZodType>),
  /** Products to offer next once this one is in the catalog. */
  related: z.array(LibraryIdSchema).readonly(),
  vat: z.object({
    CZ: VatRateSchema,
    SK: VatRateSchema,
  } satisfies Record<CountryCode, z.ZodType>),
  /**
   * `<id>.<hash>`, served at `v1/img/<image>-<size>.webp` for each of the
   * library's `imageSizes`; `null` while the product has no picture.
   */
  image: LibraryImageSchema,
  /** Still resolvable for the items pointing at it, never suggested. */
  retired: z.boolean(),
})

const StarterPackSchema = z.object({
  id: LibraryIdSchema,
  names: LocalizedNameSchema,
  products: z.array(LibraryIdSchema).readonly(),
})

/**
 * A list read entry by entry: an entry that breaks the contract, or that the
 * apps could not store, is left out rather than refusing the whole library.
 * A codec, not a transform, so the native cache can encode the list back.
 */
const tolerantList = <TEntry extends z.ZodType>(entry: TEntry) =>
  z.codec(z.array(z.unknown()), z.array(entry).readonly(), {
    decode: (entries) =>
      entries.flatMap((value) => {
        const parsed = entry.safeParse(value)
        return parsed.success ? [value as z.input<TEntry>] : []
      }),
    encode: (entries) => [...entries],
  })

/**
 * The consumer's reading of the library's `v1/library.json`: only the fields
 * the apps use. A tolerant reader — the library may add fields, languages and
 * countries within `v1`, and plain `z.object` drops what it does not know.
 * Its three lists are read entry by entry (`tolerantList`), so one bad
 * product costs that product, not the library; a related product or a pack's
 * product left out that way is skipped where it is listed, as an unknown id
 * is.
 */
export const ProductLibrarySchema = z.object({
  version: z.string(),
  imageSizes: z.array(z.number().int().positive()).readonly(),
  categories: tolerantList(LibraryCategorySchema),
  products: tolerantList(LibraryProductSchema),
  packs: tolerantList(StarterPackSchema),
})

export type ProductLibrary = z.output<typeof ProductLibrarySchema>
export type LibraryProduct = z.output<typeof LibraryProductSchema>
export type LibraryCategory = z.output<typeof LibraryCategorySchema>
export type StarterPack = z.output<typeof StarterPackSchema>

export interface ProductLibraryDep {
  readonly productLibrary: {
    /** The library deployment's origin, optionally with a path prefix. */
    readonly baseUrl: string
  }
}

export const createProductLibraryDep = ({
  baseUrl,
}: {
  readonly baseUrl: string
}): ProductLibraryDep => ({
  productLibrary: { baseUrl },
})

/** `baseUrl` and `path` joined by one slash, keeping any path prefix. */
const libraryUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/${path}`

const createProductLibraryHttpError = defineError("ProductLibraryHttpError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
}>()
export type ProductLibraryHttpError = ReturnType<
  typeof createProductLibraryHttpError
>

const createProductLibraryApiError = defineError("ProductLibraryApiError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
  readonly cause?: unknown
}>()
export type ProductLibraryApiError = ReturnType<
  typeof createProductLibraryApiError
>

/** Downloads the whole library, which the device then searches locally. */
export const loadProductLibrary =
  (): Task<
    ProductLibrary,
    ProductLibraryHttpError | ProductLibraryApiError | FetchError,
    ProductLibraryDep & FetchDep
  > =>
  async (run) =>
    await run(
      fetchAndValidateJson({
        url: libraryUrl(run.deps.productLibrary.baseUrl, "v1/library.json"),
        schema: ProductLibrarySchema,
        onHttpError: ({ status, responseBody }) =>
          createProductLibraryHttpError({
            message: `Product library request failed: ${status}`,
            status,
            responseBody,
          }),
        onResponseError: ({ status, responseBody, cause }) =>
          createProductLibraryApiError({
            message: "Invalid product library response.",
            status,
            responseBody,
            cause,
          }),
      })
    )

/**
 * The URL of a library picture at least `size` pixels wide: the smallest
 * published size that is, else the largest there is. `undefined` when the
 * library publishes no sizes at all.
 */
export const libraryImageUrl = ({
  baseUrl,
  imageSizes,
  image,
  size,
}: {
  readonly baseUrl: string
  /** The loaded library's `imageSizes`. */
  readonly imageSizes: ReadonlyArray<number>
  /** A product's `image`. */
  readonly image: string
  readonly size: number
}): string | undefined => {
  const ascending = imageSizes.toSorted((a, b) => a - b)
  const chosen =
    ascending.find((published) => published >= size) ?? ascending.at(-1)
  if (chosen === undefined) return undefined

  return libraryUrl(baseUrl, `v1/img/${image}-${chosen}.webp`)
}
