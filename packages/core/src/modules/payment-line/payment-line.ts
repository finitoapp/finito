import type { IndexesConfig } from "@evolu/common/local-first"

import { BillId } from "../bill/bill-types.ts"
import { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import { ItemId, ItemLineTypeSchema } from "../item/item-types.ts"
import { PaymentId } from "../payment/payment-types.ts"
import {
  type InferTable,
  IntegerSchema,
  PositiveNumberSchema,
} from "../shared/schema.ts"
import { PaymentLineId } from "./payment-line-types.ts"

/**
 * A frozen snapshot of one net bill-line at the moment a payment was
 * created — written once, by `snapshotBillLinesForPayment`
 * (`payment-line-actions.ts`), from `createPayment`, and never updated
 * afterward. Lets the payment detail page show *what* changed on the bill
 * since this payment was made (see `deriveBillLineSummaryDiff` in
 * `bill-line-utils.ts`), not just that the amounts no longer match. See
 * docs/bill-payment-states.md's "Bill payment coverage" section.
 *
 * `discountShare` freezes the line's part of the bill's discount
 * (`allocateDiscount`, catalog/0003), so the payment's VAT recap, its Qerko
 * receipt and a refund of the line read the net amount it was paid at
 * (`deriveLineNetAmount`) even if the allocation is ever changed. Zero or
 * less on a goods line of a discounted bill; `null` on a discount line, a
 * tip, every line of a bill without a discount, and every line frozen before
 * the column existed, which all net to their own `totalAmount`.
 */
export const paymentLine = {
  id: PaymentLineId,
  paymentId: PaymentId,
  billId: BillId.nullable(),
  catalogItemId: CatalogItemId.nullable(),
  itemId: ItemId,
  type: ItemLineTypeSchema,
  quantity: PositiveNumberSchema,
  totalAmount: IntegerSchema,
  discountShare: IntegerSchema.nonpositive().nullable(),
} as const

export const paymentLineIndexes = ((create) => [
  create("paymentLine_paymentId").on("paymentLine").column("paymentId"),
]) satisfies IndexesConfig

export type PaymentLineRow = InferTable<typeof paymentLine>
