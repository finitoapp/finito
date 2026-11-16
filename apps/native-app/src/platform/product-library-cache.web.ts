import type { ProductLibraryCache } from "./product-library-cache.ts"

/**
 * The PWA keeps nothing itself: the browser's HTTP cache holds
 * `library.json` and the pictures (the library serves them cacheable), and
 * suggestions are not worth `localStorage`, which is for per-device UI state.
 */
export const productLibraryCache: ProductLibraryCache = {
  read: () => undefined,
  write: async () => {},
}
