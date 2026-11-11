import { err, ok, type Result } from "@evolu/common"

import { defineError } from "../../error.ts"
import type { Integer } from "../shared/schema.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import type { CatalogItemRow } from "./catalog-item.ts"

/**
 * The name to show staff in the app (catalog list, item picker, scan
 * results). Prefers `internalName` over the public `name`. Never use this
 * for customer-facing output (bill/receipt line items) — those must keep
 * reading `name` directly, since the `item` snapshot taken when an item is
 * added to a bill only ever copies `name`/`description`.
 */
export const getStaffDisplayName = (item: CatalogItemRow): string =>
  item.internalName ?? item.name

/**
 * The description to show staff in the app. Prefers `internalDescription`
 * over the public `description`. Same customer-facing caveat as
 * `getStaffDisplayName` applies.
 */
export const getStaffDisplayDescription = (
  item: CatalogItemRow
): string | null => item.internalDescription ?? item.description

/**
 * Matches catalog items against a raw scanned code value. `scanCode`
 * uniqueness is not enforced anywhere (there is no server-side authority to
 * arbitrate concurrent devices assigning the same code), so more than one
 * match is an expected outcome callers must handle, not an error.
 */
export const findCatalogItemsByScanCode = (
  items: ReadonlyArray<CatalogItemRow>,
  rawValue: string
): ReadonlyArray<CatalogItemRow> => {
  const trimmed = rawValue.trim()
  if (trimmed === "") return []

  return items.filter((item) => item.scanCode === trimmed)
}

/**
 * A VAT payer's item priced at zero with no VAT rate (catalog/0001). A free
 * item still appears on the receipt and in the VAT recap, and only a rate
 * says which line of it it belongs to.
 */
export const createZeroPriceWithoutTaxRateError = defineError(
  "ZeroPriceWithoutTaxRate"
)()
export type ZeroPriceWithoutTaxRateError = ReturnType<
  typeof createZeroPriceWithoutTaxRateError
>

/**
 * A discount — an item priced below zero — with a VAT rate (catalog/0002). A
 * discount has no rate of its own: it is spread over the bill's goods before
 * VAT is worked out (catalog/0003), so a rate on it would mean nothing.
 */
export const createDiscountWithTaxRateError = defineError(
  "DiscountWithTaxRate"
)()
export type DiscountWithTaxRateError = ReturnType<
  typeof createDiscountWithTaxRateError
>

/**
 * An update that turns a discount into an item or an item into a discount
 * (catalog/0002). The sign is set only when the item is created: a discount
 * keeping the original item's `catalogItemId` would merge the sale and the
 * discount in the stats and in a payment's line diff.
 */
export const createCatalogItemPriceSignChangeError = defineError(
  "CatalogItemPriceSignChange"
)()
export type CatalogItemPriceSignChangeError = ReturnType<
  typeof createCatalogItemPriceSignChangeError
>

/** Every way a catalog item's price and VAT rate can disagree. */
export type CatalogItemPricingError =
  | ZeroPriceWithoutTaxRateError
  | DiscountWithTaxRateError
  | CatalogItemPriceSignChangeError

/** Whether a price makes its item a discount (catalog/0002). */
export const isDiscountPrice = (unitAmount: number): boolean => unitAmount < 0

/**
 * The rules a catalog item's price and VAT rate must keep together, as they
 * are about to be saved. One function for the catalog form, the inline edits
 * and the catalog-item actions, so the CLI, the core and both apps cannot
 * apply different ones. Returns the first rule the pricing breaks.
 *
 * Judged at the moment of saving only (catalog/0001): an account that becomes
 * a VAT payer later keeps its zero-priced items without a rate, and the next
 * edit of their price or rate is what catches them.
 *
 * - `vatPayer` is the account's (`isVatPayer` over `legalEntityQuery`).
 * - `originalUnitAmount` is the item's price before an update, `null` when
 *   the item is being created. An update may not move the price across zero
 *   in either direction (catalog/0002), so a discount cannot be updated to
 *   zero either: zero is not below zero.
 *
 * That a discount is never zero on create is the form's rule, not this one's
 * (catalog/0002): zero has no sign, so only the form's Discount switch says
 * whether a zero was meant as a discount.
 */
export const validateCatalogItemPricing = ({
  unitAmount,
  taxRateId,
  vatPayer,
  originalUnitAmount,
}: {
  readonly unitAmount: Integer
  readonly taxRateId: TaxRateId | null
  readonly vatPayer: boolean
  readonly originalUnitAmount: Integer | null
}): Result<void, CatalogItemPricingError> => {
  if (
    originalUnitAmount !== null &&
    isDiscountPrice(originalUnitAmount) !== isDiscountPrice(unitAmount)
  ) {
    return err(createCatalogItemPriceSignChangeError())
  }
  if (isDiscountPrice(unitAmount) && taxRateId !== null) {
    return err(createDiscountWithTaxRateError())
  }
  if (vatPayer && unitAmount === 0 && taxRateId === null) {
    return err(createZeroPriceWithoutTaxRateError())
  }

  return ok()
}
