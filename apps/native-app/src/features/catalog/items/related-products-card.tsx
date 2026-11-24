import { relatedItemCategoryId } from "@payky/app-shared/library-product-prefill"
import { libraryLanguage } from "@payky/core/integrations/product-library/product-library-client"
import { relatedSuggestions } from "@payky/core/integrations/product-library/product-library-utils"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import { router, useFocusEffect } from "expo-router"
import Plus from "lucide-react-native/icons/plus"
import X from "lucide-react-native/icons/x"
import { useCallback, useMemo, useState } from "react"
import { XStack } from "tamagui"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  libraryProductById,
  useProductLibrary,
} from "../../../hooks/use-product-library.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { shape } from "../../../theme/tokens.ts"
import { NEW_ITEM_FROM_LIST } from "./new-item-return.ts"

/** How many related products the card offers at most. */
const RELATED_LIMIT = 5

/**
 * "Add also": the related products of the library item just created
 * (`addedItemId`, the list's `?added=`), as chips that open the create form
 * filled from that product with the price left empty
 * (`docs/plans/product-library.md`). Products the catalog already has are
 * left out, so the card empties as the merchant adds them. It goes away when
 * dismissed, when nothing is left to offer, or once the list is left: coming
 * back from an item's form does not bring it back. Native-only for now: the
 * product library lands in Finito first.
 */
export function RelatedProductsCard({
  addedItemId,
  catalogItems,
}: {
  readonly addedItemId: string | undefined
  readonly catalogItems: ReadonlyArray<
    Pick<CatalogItemRow, "id" | "libraryProductId" | "categoryId">
  >
}) {
  const { t, language } = useTranslation()
  const { library } = useProductLibrary()
  // The `added` the merchant dismissed or left the list with.
  const [dismissed, setDismissed] = useState<string | undefined>(undefined)
  useFocusEffect(
    useCallback(() => () => setDismissed(addedItemId), [addedItemId])
  )

  const added = catalogItems.find((item) => item.id === addedItemId)
  const product =
    library === undefined || added === undefined
      ? undefined
      : libraryProductById(library, added.libraryProductId)
  const suggestions = useMemo(() => {
    if (library === undefined || product === undefined) return []
    const inCatalog = new Set(
      catalogItems.flatMap((item) =>
        item.libraryProductId === null ? [] : [item.libraryProductId]
      )
    )
    return relatedSuggestions(library, product, inCatalog).slice(
      0,
      RELATED_LIMIT
    )
  }, [library, product, catalogItems])

  if (
    added === undefined ||
    product === undefined ||
    dismissed === addedItemId ||
    suggestions.length === 0
  )
    return null

  return (
    <Card size="sm">
      <CardHeader pr={48}>
        <CardTitle>{t("catalog.library.addAlso")}</CardTitle>
        <CardDescription>
          {t("catalog.library.addAlso.description")}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            iconStart={X}
            aria-label={t("catalog.library.dismiss")}
            onPress={() => setDismissed(addedItemId)}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <XStack flexWrap="wrap" gap={8}>
          {suggestions.map((related) => {
            const categoryId = relatedItemCategoryId({
              created: product,
              createdCategoryId: added.categoryId,
              related,
            })
            return (
              <Button
                key={related.id}
                variant="secondary"
                size="sm"
                rounded={shape.pill}
                iconStart={Plus}
                label={related.names[libraryLanguage(language)]}
                onPress={() =>
                  router.push({
                    pathname: "/settings/items/new",
                    params: {
                      from: NEW_ITEM_FROM_LIST,
                      libraryProductId: related.id,
                      ...(categoryId === undefined ? {} : { categoryId }),
                    },
                  })
                }
              />
            )
          })}
        </XStack>
      </CardContent>
    </Card>
  )
}
