import { createIdFromString } from "@evolu/common"
import type { BillId } from "../bill/bill-types.ts"
import { createBillLineSummaryId } from "../bill-line/bill-line-utils.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import type { ItemRow } from "../item/item.ts"
import type { ItemId, ItemLineType } from "../item/item-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { Integer, PositiveNumber } from "../shared/schema.ts"
import type { PaymentLineId } from "./payment-line-types.ts"

/**
 * Turns a payment's frozen `paymentLine` rows into `BillLineSummary`-shaped
 * values by joining in the (immutable) `item` snapshot each references for
 * its name/description/currency — the same shape `calculateBillLineSummaries`
 * produces for the bill's *current* lines, so both sides of a comparison
 * line up. Unlike `calculateBillLineSummaries`, there is no add/remove to
 * net here: each `paymentLine` row already *is* one net line, frozen at
 * write time (see `snapshotBillLinesForPayment`).
 *
 * Each value keeps its frozen `discountShare`, which is what lets
 * `calculateTaxRecap` count the payment's VAT from the net amounts it was
 * paid at instead of allocating the discount again.
 *
 * Takes the shape `paymentLinesByPaymentIdQuery`'s `$narrowType` produces
 * (every field but `catalogItemId` guaranteed non-null), not the raw
 * `PaymentLineRow` — that query is the only realistic source for this.
 */
export const paymentLinesToBillLineSummaries = (
  paymentLineRows: ReadonlyArray<{
    readonly billId: BillId
    readonly catalogItemId: CatalogItemId | null
    readonly itemId: ItemId
    readonly type: ItemLineType
    readonly quantity: PositiveNumber
    readonly totalAmount: Integer
    readonly discountShare: Integer | null
  }>,
  itemRows: ReadonlyArray<ItemRow>
) => {
  const itemsById = new Map(itemRows.map((item) => [item.id, item]))

  return paymentLineRows.flatMap((line) => {
    const item = itemsById.get(line.itemId)
    if (item === undefined) return []

    return [
      {
        id: createBillLineSummaryId({
          billId: line.billId,
          catalogItemId: line.catalogItemId,
          itemId: line.itemId,
          type: line.type,
        }),
        billId: line.billId,
        catalogItemId: line.catalogItemId,
        itemId: line.itemId,
        type: line.type,
        name: item.name,
        description: item.description,
        currency: item.currency,
        quantity: line.quantity,
        totalAmount: line.totalAmount,
        discountShare: line.discountShare,
        taxRateId: item.taxRateId,
      },
    ]
  })
}

interface PaymentLineIdentityInput {
  readonly paymentId: PaymentId
  readonly catalogItemId: CatalogItemId | null
  readonly itemId: ItemId
  readonly type: ItemLineType
}

/**
 * Deterministic, not random — re-snapshotting the same payment (e.g. a
 * retried write) reproduces the same row ids instead of duplicating lines.
 */
export const createPaymentLineId = (
  input: PaymentLineIdentityInput
): PaymentLineId =>
  createIdFromString<"PaymentLine">(
    JSON.stringify({
      paymentId: input.paymentId,
      catalogItemId: input.catalogItemId,
      itemId: input.itemId,
      type: input.type,
    })
  )
