import {
  isStarterProductChecked,
  isStarterProductPriceInvalid,
  type OnboardingStarterPack,
  offeredStarterPacks,
  pickStarterPack,
  setStarterProductChecked,
  setStarterProductPrice,
  starterPackOffer,
} from "@payky/app-shared/onboarding-starter-pack"
import { onboardingCurrency } from "@payky/app-shared/onboarding-utils"
import type { ProductLibrary } from "@payky/core/integrations/product-library/product-library-client"
import { libraryLanguage } from "@payky/core/integrations/product-library/product-library-client"
import { Text, XStack, YStack } from "tamagui"
import {
  LibraryPicture,
  libraryPictureUrl,
} from "../../components/library-picture.tsx"
import { Card, CardContent } from "../../components/ui/card.tsx"
import { Checkbox } from "../../components/ui/checkbox.tsx"
import { Input } from "../../components/ui/input.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useProductLibrary } from "../../hooks/use-product-library.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/** "Start empty" in the pack choice; a library id is never empty. */
const START_EMPTY = ""

/** A product's picture beside its name, as small as a list row allows. */
const PICTURE_SIZE = 40

/**
 * "Start with a menu" on onboarding's last step, under "Bills"
 * (`docs/plans/product-library.md`): the library's starter packs, named in
 * the device language, beside "Start empty", the initial choice; a picked
 * pack lists its products, each checked, with its picture and an empty
 * price field in the onboarding currency. The page keeps Finish unavailable
 * until every checked product has a price (`canFinishOnboarding`), so this
 * section says what is missing; and while the pack picked is one a fresher
 * library no longer offers (`isPickedStarterPackUnavailable`), it asks for
 * another pick, which "Start empty" answers too. Finito only for now:
 * starter packs land in Finito first.
 */
export function StarterPackSection({
  library,
  starterPack,
  unavailable,
  missingPrices,
  pending,
  onStarterPackChange,
}: {
  readonly library: ProductLibrary
  readonly starterPack: OnboardingStarterPack
  /** The pack picked is no longer offered. */
  readonly unavailable: boolean
  /** Some checked product still has no valid price. */
  readonly missingPrices: boolean
  readonly pending: boolean
  readonly onStarterPackChange: (
    update: (current: OnboardingStarterPack) => OnboardingStarterPack
  ) => void
}) {
  const { language, t } = useTranslation()
  const { baseUrl } = useProductLibrary()
  const packs = offeredStarterPacks(library, language)
  const products =
    starterPack.packId === null
      ? []
      : starterPackOffer(library, starterPack.packId, language)
  return (
    <YStack gap={12}>
      <YStack gap={4} px={4}>
        <Text
          fontSize={fontSize.base}
          lineHeight={fontSize.base}
          fontWeight={fontWeight.semibold}
          role="heading"
          aria-level={2}
        >
          {t("onboarding.starterPack.title")}
        </Text>
        <Text color="muted-foreground" fontSize={fontSize.sm}>
          {t("onboarding.starterPack.description")}
        </Text>
      </YStack>
      <ToggleGroup
        value={starterPack.packId ?? START_EMPTY}
        onValueChange={(packId) =>
          onStarterPackChange((current) =>
            pickStarterPack(current, packId === START_EMPTY ? null : packId)
          )
        }
        aria-label={t("onboarding.starterPack.title")}
        variant="outline"
        columns={2}
        disabled={pending}
      >
        <ToggleGroupItem value={START_EMPTY} minH={44}>
          {t("onboarding.starterPack.empty")}
        </ToggleGroupItem>
        {packs.map((pack) => (
          <ToggleGroupItem key={pack.id} value={pack.id} minH={44}>
            {pack.names[libraryLanguage(language)]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {products.length === 0 ? null : (
        <Card size="sm">
          <CardContent gap={4}>
            {products.map(({ product, name }) => {
              const checked = isStarterProductChecked(starterPack, product.id)
              return (
                <XStack key={product.id} items="center" gap={12} minH={56}>
                  <Checkbox
                    checked={checked}
                    disabled={pending}
                    aria-label={t("onboarding.starterPack.include", { name })}
                    onCheckedChange={(next) =>
                      onStarterPackChange((current) =>
                        setStarterProductChecked(current, product.id, next)
                      )
                    }
                  />
                  <LibraryPicture
                    url={libraryPictureUrl({
                      library,
                      baseUrl,
                      libraryProductId: product.id,
                      size: PICTURE_SIZE,
                    })}
                    size={PICTURE_SIZE}
                  />
                  <Text
                    flex={1}
                    numberOfLines={2}
                    color={checked ? "color" : "muted-foreground"}
                  >
                    {name}
                  </Text>
                  <XStack items="center" gap={6}>
                    <Input
                      w={88}
                      keyboardType="decimal-pad"
                      text="right"
                      value={starterPack.prices[product.id] ?? ""}
                      placeholder={t("onboarding.starterPack.pricePlaceholder")}
                      aria-label={t("onboarding.starterPack.priceLabel", {
                        name,
                      })}
                      disabled={pending || !checked}
                      invalid={
                        checked &&
                        isStarterProductPriceInvalid(starterPack, product.id)
                      }
                      onChangeText={(price) =>
                        onStarterPackChange((current) =>
                          setStarterProductPrice(current, product.id, price)
                        )
                      }
                    />
                    <Text color="muted-foreground" fontSize={fontSize.sm}>
                      {onboardingCurrency}
                    </Text>
                  </XStack>
                </XStack>
              )
            })}
          </CardContent>
        </Card>
      )}
      {unavailable ? (
        <Text px={4} color="muted-foreground" fontSize={fontSize.sm}>
          {t("onboarding.starterPack.unavailable")}
        </Text>
      ) : null}
      {missingPrices ? (
        <Text px={4} color="muted-foreground" fontSize={fontSize.sm}>
          {t("onboarding.starterPack.missingPrices")}
        </Text>
      ) : null}
    </YStack>
  )
}
