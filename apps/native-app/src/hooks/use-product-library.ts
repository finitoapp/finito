import {
  createProductLibraryDep,
  type LibraryProduct,
  loadProductLibrary,
  type ProductLibrary,
} from "@payky/core/integrations/product-library/product-library-client"
import { useQuery } from "@tanstack/react-query"
import { nativeEnv } from "../core/native-env.ts"
import { nativeRun } from "../core/native-runtime.ts"
import { createFetchDep } from "../platform/native-deps.ts"
import { productLibraryCache } from "../platform/product-library-cache"

const baseUrl = nativeEnv.EXPO_PUBLIC_PRODUCT_LIBRARY_BASE_URL

export interface ProductLibraryState {
  /** `undefined` until a load (or the offline copy) answers, and for good when it never does. */
  readonly library: ProductLibrary | undefined
  /** The library's host, which picture URLs are built from; `undefined` when the build has none. */
  readonly baseUrl: string | undefined
}

/**
 * The shared product library (`docs/plans/product-library.md`), downloaded
 * whole and searched on the device. Needs no account, so onboarding can read
 * it too. Loaded the first time a screen asks and refreshed at most hourly;
 * on Android the last download is kept in the cache directory and answers at
 * once, offline included, while the fresh one loads (the PWA relies on the
 * browser's HTTP cache). A build without `EXPO_PUBLIC_PRODUCT_LIBRARY_BASE_URL`
 * never loads it. A failed load only means no suggestions and no pictures:
 * it is never toasted nor reported, and leaves the last library in place.
 */
export function useProductLibrary(): ProductLibraryState {
  const query = useQuery({
    queryKey: ["productLibrary", baseUrl],
    enabled: baseUrl !== undefined,
    staleTime: 60 * 60 * 1000,
    // App-wide data: keep it while no screen shows it.
    gcTime: Number.POSITIVE_INFINITY,
    retry: 2,
    // The offline copy, dated as old so the network load still runs.
    initialData: () =>
      baseUrl === undefined ? undefined : productLibraryCache.read(),
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      if (baseUrl === undefined) throw new Error("No product library host.")
      await using run = nativeRun.create({
        ...createFetchDep(),
        ...createProductLibraryDep({ baseUrl }),
      })
      const result = await run(loadProductLibrary())
      if (!result.ok) throw result.error
      await productLibraryCache.write(result.value)
      return result.value
    },
  })

  return { library: query.data, baseUrl }
}

const productIndexes = new WeakMap<
  ProductLibrary,
  ReadonlyMap<string, LibraryProduct>
>()

/** The library's products by id, built once per loaded library. */
const productIndex = (
  library: ProductLibrary
): ReadonlyMap<string, LibraryProduct> => {
  const known = productIndexes.get(library)
  if (known !== undefined) return known
  const index = new Map(
    library.products.map((product) => [product.id, product])
  )
  productIndexes.set(library, index)
  return index
}

/**
 * The library product of `libraryProductId` (`catalogItem.libraryProductId`),
 * retired ones included, as core's `findLibraryProduct` but indexed once per
 * library, for a grid of items asking at once; `undefined` without an id or
 * when the library does not know it.
 */
export const libraryProductById = (
  library: ProductLibrary,
  libraryProductId: string | null
): LibraryProduct | undefined =>
  libraryProductId === null
    ? undefined
    : productIndex(library).get(libraryProductId)

/**
 * The library product a catalog item came from (`catalogItem.libraryProductId`);
 * `undefined` without one, without a loaded library, or when the library does
 * not know the id.
 */
export function useLibraryProduct(
  libraryProductId: string | null
): LibraryProduct | undefined {
  const { library } = useProductLibrary()
  return library === undefined
    ? undefined
    : libraryProductById(library, libraryProductId)
}
