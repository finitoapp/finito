import { ok, sqliteTrue, type Task } from "@evolu/common"

import type { EvoluOwnerDep } from "../../deps.ts"
import { billLinesByBillIdQuery } from "../bill-line/bill-line-queries.ts"
import { itemsByBillIdQuery } from "../item/item-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { closingClaimsByBillIdQuery } from "./bill-closing-queries.ts"
import { deriveCoveredSinceClock } from "./bill-closing-utils.ts"
import { loadWriteClocks } from "./bill-overpayment-guards.ts"
import type { BillId, SyncClockHex } from "./bill-types.ts"

const earlierClock = (
  a: SyncClockHex | undefined,
  b: SyncClockHex | undefined
): SyncClockHex | null => {
  if (a === undefined) return b ?? null
  if (b === undefined) return a
  return a < b ? a : b
}

export const loadBillCoveredSince =
  (
    billId: BillId
  ): Task<SyncClockHex | null, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu } = run.deps
    const [lines, items, claims] = await Promise.all([
      evolu.loadQuery(billLinesByBillIdQuery(billId)),
      evolu.loadQuery(itemsByBillIdQuery(billId)),
      evolu.loadQuery(closingClaimsByBillIdQuery(billId)),
    ])
    const [lineClocks, claimClocks, claimRemovals, transactionRemovals] =
      await Promise.all([
        run.ok(
          loadWriteClocks({ table: "billLine", ids: lines.map(({ id }) => id) })
        ),
        run.ok(
          loadWriteClocks({
            table: "reconciliationClaim",
            ids: claims.map(({ claimId }) => claimId),
          })
        ),
        run.ok(
          loadWriteClocks({
            table: "reconciliationClaim",
            ids: claims
              .filter(({ isClaimDeleted }) => isClaimDeleted === sqliteTrue)
              .map(({ claimId }) => claimId),
            column: "isDeleted",
            pick: "last",
          })
        ),
        run.ok(
          loadWriteClocks({
            table: "accountTransaction",
            ids: claims
              .filter(
                ({ isTransactionDeleted }) =>
                  isTransactionDeleted === sqliteTrue
              )
              .map(({ accountTransactionId }) => accountTransactionId),
            column: "isDeleted",
            pick: "last",
          })
        ),
      ])

    return ok(
      deriveCoveredSinceClock({
        lines: lines.map((row) => ({
          row,
          clock: lineClocks.get(row.id) ?? "",
        })),
        items,
        claims: claims.map((claim) => ({
          transaction: {
            paymentId: claim.paymentId,
            tipAmount: claim.tipAmount,
            accountTransactionId: claim.accountTransactionId,
            amount: claim.amount,
            currency: claim.currency,
            paymentAmount: claim.paymentAmount,
            paymentCurrency: claim.paymentCurrency,
            paymentAmountSats: claim.paymentAmountSats,
          },
          startClock: claimClocks.get(claim.claimId) ?? "",
          endClock: earlierClock(
            claimRemovals.get(claim.claimId),
            transactionRemovals.get(claim.accountTransactionId)
          ),
        })),
      })
    )
  }
