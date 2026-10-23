import { type MutationOptions, ok, type Task } from "@evolu/common"

import type { EvoluOwnerDep } from "../../deps.ts"
import type { BillId } from "../bill/bill-types.ts"
import { itemsByBillIdQuery } from "../item/item-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import type { BillLineRow } from "./bill-line.ts"
import { billLinesByBillIdQuery } from "./bill-line-queries.ts"
import type { BillLineSummary } from "./bill-line-summary.ts"
import { calculateBillLineSummaries } from "./bill-line-utils.ts"

/**
 * Inserts already-computed bill line rows. Takes the caller's own
 * `MutationOptions` so the writes can join an existing mutation batch instead
 * of always opening a new one.
 */
export const insertBillLineRows = (
  evolu: EvoluDep["evolu"],
  lines: ReadonlyArray<Omit<BillLineRow, "id">>,
  options: MutationOptions
): void => {
  for (const line of lines) {
    evolu.insert("billLine", removeUndefinedValues(line), options)
  }
}

export const upsertBillLineRows = (
  evolu: EvoluDep["evolu"],
  lines: ReadonlyArray<BillLineRow>,
  options: MutationOptions
): void => {
  for (const line of lines) {
    evolu.upsert("billLine", removeUndefinedValues(line), options)
  }
}

export const loadCalculatedBillLineSummaries =
  (billId: BillId): Task<ReadonlyArray<BillLineSummary>, never, EvoluDep> =>
  async (run) => {
    const [lineRows, itemRows] = await Promise.all([
      run.deps.evolu.loadQuery(billLinesByBillIdQuery(billId)),
      run.deps.evolu.loadQuery(itemsByBillIdQuery(billId)),
    ])

    return ok(calculateBillLineSummaries(lineRows, itemRows))
  }

export const appendBillLines =
  (
    lines: ReadonlyArray<Omit<BillLineRow, "id">>,
    returnBillId?: BillId
  ): Task<ReadonlyArray<BillLineSummary>, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    if (lines.length > 0) {
      await runMutationWithCompletion((options) =>
        insertBillLineRows(run.deps.evolu, lines, {
          ...options,
          owner: evoluOwner,
        })
      )
    }

    // Only the requested bill's summaries are loaded. This used to compute
    // them for every bill appearing in `lines` — into a map it then read a
    // single entry out of — so a batch touching another bill paid for two
    // extra queries whose result was discarded. No caller passes lines across
    // bills anyway: `splitBill` writes those through `insertBillLineRows`
    // directly.
    const targetBillId = returnBillId ?? lines.at(-1)?.billId
    if (targetBillId === undefined) {
      return ok([])
    }

    return await run(loadCalculatedBillLineSummaries(targetBillId))
  }
