import { id } from "@evolu/common"
import type { RequireExactlyOne } from "type-fest"
import { standardSchemaToZod } from "../../zod-utils.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { createRowId } from "../shared/evolu-utils.ts"

export const BillIdRaw = id("Bill")
export const BillId = standardSchemaToZod(BillIdRaw)
export type BillId = typeof BillIdRaw.Output

export const BillClosingCursorIdRaw = id("BillClosingCursor")
export const BillClosingCursorId = standardSchemaToZod(BillClosingCursorIdRaw)
export type BillClosingCursorId = typeof BillClosingCursorIdRaw.Output

/**
 * A fresh, client-generated `BillId` that hasn't been written to Evolu yet —
 * used to put a new cart's id in the `/bill` URL immediately, before its bill
 * row is lazily created on the first added line (see `use-cart-bill.ts`'s
 * `ensureBillExists`).
 */
export const createRandomBillId = (): BillId => createRowId<"Bill">()

export type BillCoverage = "paid" | "underpaid" | "overpaid"

export type SyncClockHex = string

export type OverpaymentScope = RequireExactlyOne<{
  readonly billId: BillId
  readonly paymentId: PaymentId
}>

export interface OverpaymentScopes {
  readonly billIds: ReadonlyArray<BillId>
  readonly paymentIds: ReadonlyArray<PaymentId>
}

export const overpaymentScopesOf = (
  scope: OverpaymentScope
): OverpaymentScopes =>
  scope.billId === undefined
    ? { billIds: [], paymentIds: [scope.paymentId] }
    : { billIds: [scope.billId], paymentIds: [] }

export type BillStatus = "open" | "closed" | "canceled"
