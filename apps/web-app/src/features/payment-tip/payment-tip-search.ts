import { BillId } from "@payky/core/modules/bill/bill-types"
import { FiatCurrencySchema } from "@payky/core/modules/shared/schema"
import { z } from "zod"

/**
 * The search of the tip step and of its custom tip screen. Every field falls
 * back instead of throwing: a `validateSearch` throw on a stale or hand-typed
 * link escapes to the global error boundary (see `_terminal.bill.tsx`). No
 * amount or currency means there is nothing to tip on, which the route
 * shows; a broken `billId` only loses the bill link.
 */
export const PaymentTipSearchSchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .optional()
    .catch(undefined),
  currency: FiatCurrencySchema.optional().catch(undefined),
  billId: BillId.optional().catch(undefined),
})
