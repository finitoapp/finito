import {
  type ProductLibrary,
  ProductLibrarySchema,
} from "@payky/core/integrations/product-library/product-library-client"
import { jsonCodec } from "@payky/core/zod-utils"
import { File, Paths } from "expo-file-system"
import { z } from "zod"

/**
 * The last product library this device downloaded, kept so name suggestions
 * and pictures work offline after a first load. The app's cache directory:
 * Android may clear it, which costs only a fresh download.
 */
export interface ProductLibraryCache {
  /** The kept library, `undefined` when there is none or it no longer reads. */
  readonly read: () => ProductLibrary | undefined
  /** Never rejects: a failed write only leaves the older copy. */
  readonly write: (library: ProductLibrary) => Promise<void>
}

const ProductLibraryJson = jsonCodec(ProductLibrarySchema)

const cacheFile = () => new File(Paths.cache, "product-library-v1.json")

export const productLibraryCache: ProductLibraryCache = {
  read: () => {
    try {
      const file = cacheFile()
      if (!file.exists) return undefined
      const decoded = z.safeDecode(ProductLibraryJson, file.textSync())
      return decoded.success ? decoded.data : undefined
    } catch {
      // An unreadable file is a cache miss, never an error to show.
      return undefined
    }
  },
  write: async (library) => {
    try {
      const file = cacheFile()
      if (!file.exists) file.create()
      await file.write(z.encode(ProductLibraryJson, library))
    } catch {
      // Only offline use suffers; the next successful load tries again.
    }
  },
}
