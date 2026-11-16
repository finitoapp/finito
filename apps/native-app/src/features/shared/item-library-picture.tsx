import Unlink from "lucide-react-native/icons/unlink"
import { Text, XStack, YStack } from "tamagui"
import {
  LibraryPicture,
  libraryPictureUrl,
} from "../../components/library-picture.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  libraryProductById,
  useProductLibrary,
} from "../../hooks/use-product-library.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize } from "../../theme/tokens.ts"

/** The side of the picture in an item's form. */
const FORM_PICTURE_SIZE = 64

/**
 * The library product an item form's item comes from (catalog/0006): its
 * picture when it has one, and in every case a line naming the product, so
 * a link stays visible without a picture, with "Unlink from library", which
 * sets `libraryProductId` to `null`: the create forms forget the product
 * picked, the edit form saves the removal. Nothing for an item without a
 * library product, or while the library does not know it. Native-only for
 * now: the product library lands in Finito first.
 */
export function ItemLibraryPicture({
  libraryProductId,
  onUnlink,
  disabled = false,
}: {
  readonly libraryProductId: string | null
  readonly onUnlink: () => void
  readonly disabled?: boolean
}) {
  const { language, t } = useTranslation()
  const { library, baseUrl } = useProductLibrary()
  const product =
    library === undefined
      ? undefined
      : libraryProductById(library, libraryProductId)
  if (product === undefined) return null
  const url = libraryPictureUrl({
    library,
    baseUrl,
    libraryProductId,
    size: FORM_PICTURE_SIZE,
  })
  return (
    <XStack items="center" gap={12}>
      <LibraryPicture url={url} size={FORM_PICTURE_SIZE} />
      <YStack flex={1} minW={0} gap={8} items="flex-start">
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
          numberOfLines={2}
        >
          {t("catalog.library.linked", { name: product.names[language] })}
        </Text>
        <Button
          variant="outline"
          size="sm"
          iconStart={Unlink}
          label={t("catalog.library.unlink")}
          disabled={disabled}
          onPress={onUnlink}
        />
      </YStack>
    </XStack>
  )
}
