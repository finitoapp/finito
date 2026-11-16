import type { DeviceLanguage } from "@payky/core/evolu/device-client"
import type {
  LibraryProduct,
  ProductLibrary,
  StarterPack,
} from "@payky/core/integrations/product-library/product-library-client"
import {
  libraryCategoryName,
  starterPackProducts,
} from "@payky/core/integrations/product-library/product-library-utils"
import type { AlreadyOnboardedError } from "@payky/core/modules/app-settings/app-settings-actions"
import type {
  OnboardingStarterItem,
  TerminalHomeMode,
} from "@payky/core/modules/app-settings/app-settings-types"
import type { CatalogItemPricingError } from "@payky/core/modules/catalog-item/catalog-item-utils"
import { decimalPriceToMinorUnits } from "@payky/core/modules/shared/money"
import {
  type NonEmptyString255,
  NonEmptyString255Schema,
  type NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { TaxRatePercentage } from "@payky/core/modules/tax-rate/tax-rate-types"
import type { TranslationKey } from "./i18n/resources.ts"
import type { OnboardingAccountType } from "./onboarding-form-state.ts"
import { onboardingCountry, onboardingCurrency } from "./onboarding-utils.ts"

/**
 * The starter pack on onboarding's last step (`docs/plans/product-library.md`):
 * "Start empty" until the merchant picks a pack, then every one of its
 * products checked until unchecked, each with the price typed for it. Prices
 * are kept per product while the step is open, so switching packs or modes
 * back and forth loses no typing; only what `onboardingStarterItems` reads
 * is ever submitted.
 */
export interface OnboardingStarterPack {
  /** The picked pack's library id; `null` is "Start empty", the initial choice. */
  readonly packId: string | null
  /** The picked pack's products the merchant unchecked; the rest are checked. */
  readonly uncheckedProductIds: ReadonlyArray<string>
  /** The price typed for each library product, as typed; none is prefilled. */
  readonly prices: Readonly<Record<string, string>>
}

export const initialOnboardingStarterPack: OnboardingStarterPack = {
  packId: null,
  uncheckedProductIds: [],
  prices: {},
}

/** Picks a pack (`null` for "Start empty"); a different pack starts all checked. */
export const pickStarterPack = (
  state: OnboardingStarterPack,
  packId: string | null
): OnboardingStarterPack =>
  packId === state.packId
    ? state
    : { ...state, packId, uncheckedProductIds: [] }

export const isStarterProductChecked = (
  state: OnboardingStarterPack,
  productId: string
): boolean => !state.uncheckedProductIds.includes(productId)

export const setStarterProductChecked = (
  state: OnboardingStarterPack,
  productId: string,
  checked: boolean
): OnboardingStarterPack => ({
  ...state,
  uncheckedProductIds: checked
    ? state.uncheckedProductIds.filter((id) => id !== productId)
    : [
        ...state.uncheckedProductIds.filter((id) => id !== productId),
        productId,
      ],
})

export const setStarterProductPrice = (
  state: OnboardingStarterPack,
  productId: string,
  price: string
): OnboardingStarterPack => ({
  ...state,
  prices: { ...state.prices, [productId]: price },
})

/**
 * A typed price in the onboarding currency, in minor units: zero included
 * (an item may be given away, catalog/0001), a sign or anything the currency
 * cannot hold refused. `null` for a blank or invalid one.
 */
export const starterProductPrice = (
  state: OnboardingStarterPack,
  productId: string
): NonNegativeInteger | null =>
  decimalPriceToMinorUnits({
    currency: onboardingCurrency,
    value: state.prices[productId] ?? "",
  })

/** Whether a typed price is one the field should flag: typed, but not a price. */
export const isStarterProductPriceInvalid = (
  state: OnboardingStarterPack,
  productId: string
): boolean =>
  (state.prices[productId] ?? "").trim() !== "" &&
  starterProductPrice(state, productId) === null

/**
 * Whether the last step offers starter packs: only to a new account that
 * sells from items, and only once the library has loaded with a pack to
 * offer. A restored phrase set up afresh (`existingMnemonic`) may still find
 * its catalog on a relay, so it starts empty like any opened account.
 */
export const offersStarterPacks = ({
  library,
  accountType,
  homeMode,
  language,
}: {
  readonly library: ProductLibrary | undefined
  readonly accountType: OnboardingAccountType | null
  readonly homeMode: TerminalHomeMode | null
  readonly language: DeviceLanguage
}): boolean =>
  library !== undefined &&
  (accountType ?? "new") === "new" &&
  homeMode === "pos" &&
  offeredStarterPacks(library, language).length > 0

export interface StarterPackProduct {
  readonly product: LibraryProduct
  /** The product's name in the device language. */
  readonly name: NonEmptyString255
}

/**
 * The products a pack lists on the step, in its order: its suggestable ones
 * (`starterPackProducts`) with a name an item can carry.
 */
export const starterPackOffer = (
  library: ProductLibrary,
  packId: string,
  language: DeviceLanguage
): ReadonlyArray<StarterPackProduct> =>
  starterPackProducts(library, packId).flatMap((product) => {
    const name = NonEmptyString255Schema.safeParse(product.names[language])
    return name.success ? [{ product, name: name.data }] : []
  })

/** The packs the step offers, those with a product to list. */
export const offeredStarterPacks = (
  library: ProductLibrary,
  language: DeviceLanguage
): ReadonlyArray<StarterPack> =>
  library.packs.filter(
    (pack) => starterPackOffer(library, pack.id, language).length > 0
  )

interface StarterItemsContext {
  readonly library: ProductLibrary | undefined
  readonly accountType: OnboardingAccountType | null
  readonly homeMode: TerminalHomeMode | null
  readonly starterPack: OnboardingStarterPack
  readonly language: DeviceLanguage
}

/**
 * Whether the picked pack is gone from the packs offered to a new account
 * selling from items: a fresher library replaced the one it was picked from
 * and no longer lists it. The step then asks for another pick, and cannot
 * finish until it gets one, rather than finish with an empty catalog.
 */
export const isPickedStarterPackUnavailable = ({
  library,
  accountType,
  homeMode,
  starterPack,
  language,
}: StarterItemsContext): boolean =>
  library !== undefined &&
  starterPack.packId !== null &&
  (accountType ?? "new") === "new" &&
  homeMode === "pos" &&
  !offeredStarterPacks(library, language).some(
    (pack) => pack.id === starterPack.packId
  )

/**
 * What finishing submits as `finishOnboarding`'s `starterItems`: none
 * without a pack offered and picked, else the pack's checked products at the
 * prices typed, named and categorized in the device language, with the
 * library's VAT for the onboarding country. `null` while a checked product
 * has no valid typed price, nothing is ever sold at a price the merchant did
 * not type, and while the picked pack is no longer offered
 * (`isPickedStarterPackUnavailable`), nothing the merchant picked is
 * silently dropped.
 */
export const onboardingStarterItems = ({
  library,
  accountType,
  homeMode,
  starterPack,
  language,
}: StarterItemsContext): ReadonlyArray<OnboardingStarterItem> | null => {
  if (
    isPickedStarterPackUnavailable({
      library,
      accountType,
      homeMode,
      starterPack,
      language,
    })
  )
    return null
  if (
    library === undefined ||
    starterPack.packId === null ||
    !offersStarterPacks({ library, accountType, homeMode, language })
  )
    return []

  const items: OnboardingStarterItem[] = []
  for (const { product, name } of starterPackOffer(
    library,
    starterPack.packId,
    language
  )) {
    if (!isStarterProductChecked(starterPack, product.id)) continue
    const unitAmount = starterProductPrice(starterPack, product.id)
    if (unitAmount === null) return null
    const categoryName = NonEmptyString255Schema.safeParse(
      libraryCategoryName(library, product, language)
    )
    const vat = product.vat[onboardingCountry]
    items.push({
      name,
      // A library id is at most 255 characters, so it always parses.
      libraryProductId: NonEmptyString255Schema.parse(product.id),
      unitAmount,
      categoryName: categoryName.success ? categoryName.data : null,
      taxRatePercentage: vat === undefined ? null : TaxRatePercentage(vat),
    })
  }
  return items
}

/**
 * Whether the last step can finish: a way of selling picked (onboarding/0012),
 * a picked starter pack still offered, and every checked starter product
 * priced.
 */
export const canFinishOnboarding = (context: StarterItemsContext): boolean =>
  context.homeMode !== null && onboardingStarterItems(context) !== null

/**
 * The message for each way finishing can be refused. A pricing refusal is a
 * starter product given away for 0 that the library gives no VAT rate for
 * (catalog/0001); the other two cannot happen to a new, non-negative price,
 * and read the same.
 */
export const finishOnboardingErrorKeys = {
  AlreadyOnboarded: "onboarding.alreadyOnboarded",
  ZeroPriceWithoutTaxRate: "onboarding.starterPack.pricingFailed",
  DiscountWithTaxRate: "onboarding.starterPack.pricingFailed",
  CatalogItemPriceSignChange: "onboarding.starterPack.pricingFailed",
} satisfies Record<
  AlreadyOnboardedError["type"] | CatalogItemPricingError["type"],
  TranslationKey
>
