import X from "lucide-react-native/icons/x"
import { XStack } from "tamagui"
import {
  LibraryPicture,
  useLibraryPictureUrl,
} from "../../components/library-picture.tsx"
import { Button } from "../../components/ui/button.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

/** The side of the picture in an item's form. */
const FORM_PICTURE_SIZE = 64

/**
 * The picture an item form shows for the library product the item comes
 * from, with "Remove picture", which unlinks the item from the product
 * (`libraryProductId` to `null`): the create forms forget the product
 * picked, the edit form saves the removal. Nothing without a picture to
 * show. Native-only for now: the product library lands in Finito first.
 */
export function ItemLibraryPicture({
  libraryProductId,
  onRemove,
  disabled = false,
}: {
  readonly libraryProductId: string | null
  readonly onRemove: () => void
  readonly disabled?: boolean
}) {
  const { t } = useTranslation()
  const pictured =
    useLibraryPictureUrl(libraryProductId, FORM_PICTURE_SIZE) !== undefined
  if (!pictured) return null
  return (
    <XStack items="center" gap={12}>
      <LibraryPicture
        libraryProductId={libraryProductId}
        size={FORM_PICTURE_SIZE}
      />
      <Button
        variant="outline"
        size="sm"
        iconStart={X}
        label={t("catalog.library.removePicture")}
        disabled={disabled}
        onPress={onRemove}
      />
    </XStack>
  )
}
