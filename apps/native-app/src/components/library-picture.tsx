import {
  libraryImageUrl,
  type ProductLibrary,
} from "@payky/core/integrations/product-library/product-library-client"
import { Image } from "expo-image"
import { PixelRatio, StyleSheet } from "react-native"
import { View } from "tamagui"
import {
  libraryProductById,
  type ProductLibraryState,
} from "../hooks/use-product-library.ts"
import { isReduceMotionEnabled } from "../platform/reduce-motion.ts"
import { shape } from "../theme/tokens.ts"

/**
 * The URL of the picture of a catalog item's library product, sized for
 * `size` points on this screen's pixel density; `undefined` when the item
 * has no library product, the library is not loaded or does not know it, or
 * the product has no picture. A screen reads the library once
 * (`useProductLibrary`) and asks this for each picture it shows.
 */
export const libraryPictureUrl = ({
  library,
  baseUrl,
  libraryProductId,
  size,
}: {
  readonly library: ProductLibrary | undefined
  readonly baseUrl: string
  readonly libraryProductId: string | null
  readonly size: number
}): string | undefined => {
  if (library === undefined) return undefined
  const product = libraryProductById(library, libraryProductId)
  if (product === undefined || product.image === null) return undefined
  return libraryImageUrl({
    baseUrl,
    imageSizes: library.imageSizes,
    image: product.image,
    size: Math.ceil(size * PixelRatio.get()),
  })
}

/**
 * A reader of picture URLs over one read of the library, for a list or grid
 * whose every row may show a picture: one query observer for all of them.
 */
export const libraryPictureUrlReader =
  ({ library, baseUrl }: ProductLibraryState) =>
  (libraryProductId: string | null, size: number): string | undefined =>
    libraryPictureUrl({ library, baseUrl, libraryProductId, size })

/**
 * A catalog item's picture from the product library: a `size`-point square,
 * rounded as a control, on the muted fill until the picture loads. Renders
 * nothing without a `url` (`libraryPictureUrl`). Decorative: the item's name
 * beside it says what it is. Pictures are content-addressed, so expo-image
 * keeps them in memory and on disk for good. Native-only for now: the
 * product library's pictures land in Finito first.
 */
export function LibraryPicture({
  url,
  size,
}: {
  readonly url: string | undefined
  /** The square's side in points. */
  readonly size: number
}) {
  if (url === undefined) return null
  return (
    <View
      w={size}
      h={size}
      shrink={0}
      rounded={shape.control}
      overflow="hidden"
      bg="neutral-soft"
      pointerEvents="none"
      aria-hidden
    >
      <Image
        source={url}
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={isReduceMotionEnabled() ? 0 : 150}
        accessible={false}
      />
    </View>
  )
}

/**
 * A library picture filling its parent edge to edge (`cover`), on the muted
 * fill until it loads: the bill's item tile, which its picture fills. The
 * parent is positioned and clips it to its own shape. Decorative, as
 * `LibraryPicture`.
 */
export function LibraryPictureFill({ url }: { readonly url: string }) {
  return (
    <View
      position="absolute"
      t={0}
      r={0}
      b={0}
      l={0}
      bg="neutral-soft"
      pointerEvents="none"
      aria-hidden
    >
      <Image
        source={url}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={isReduceMotionEnabled() ? 0 : 150}
        accessible={false}
      />
    </View>
  )
}
