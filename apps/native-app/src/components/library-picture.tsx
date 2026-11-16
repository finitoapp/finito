import { libraryImageUrl } from "@payky/core/integrations/product-library/product-library-client"
import { Image } from "expo-image"
import { PixelRatio } from "react-native"
import { View } from "tamagui"
import {
  libraryProductById,
  useProductLibrary,
} from "../hooks/use-product-library.ts"
import { isReduceMotionEnabled } from "../platform/reduce-motion.ts"
import { shape } from "../theme/tokens.ts"

/**
 * The URL of the picture of a catalog item's library product, sized for
 * `size` points on this screen's pixel density; `undefined` when the item
 * has no library product, the library is not loaded or does not know it, or
 * the product has no picture.
 */
export function useLibraryPictureUrl(
  libraryProductId: string | null,
  size: number
): string | undefined {
  const { library, baseUrl } = useProductLibrary()
  if (library === undefined || baseUrl === undefined) return undefined
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
 * A catalog item's picture from the product library: a `size`-point square,
 * rounded as a control, on the muted fill until the picture loads. Renders
 * nothing when there is no picture (`useLibraryPictureUrl`). Decorative: the
 * item's name beside it says what it is. Pictures are content-addressed, so
 * expo-image keeps them in memory and on disk for good. Native-only for now:
 * the product library's pictures land in Finito first.
 */
export function LibraryPicture({
  libraryProductId,
  size,
}: {
  readonly libraryProductId: string | null
  /** The square's side in points. */
  readonly size: number
}) {
  const url = useLibraryPictureUrl(libraryProductId, size)
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
