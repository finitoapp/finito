import {
  err,
  type InsertValues,
  ok,
  sqliteTrue,
  type Task,
  type UpdateValues,
} from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import { openBillsByTableIdQuery } from "../bill/bill-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  getNextSortOrder,
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { NonNegativeInteger, TimestampMs } from "../shared/schema.ts"
import type { Table, TableRow } from "./table.ts"
import { lastTableSortOrderQuery, tablesQuery } from "./table-queries.ts"
import type { TableId } from "./table-types.ts"
import { generateTableCode } from "./table-utils.ts"

export const createTable =
  (
    input: InsertValues<Table>
  ): Task<TableId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps
    const { id } = await runMutationWithCompletion((options) =>
      run.deps.evolu.insert("table", removeUndefinedValues(input), {
        ...options,
        owner: evoluOwner,
      })
    )
    return ok(id)
  }

/**
 * Creates a table appended after the current last one, deriving `sortOrder`
 * from the highest existing value and generating its `code` instead of
 * taking either as input. There is no reorder UI yet, so this is the only
 * way callers assign `sortOrder` when adding a new table.
 */
export const createTableAtEnd =
  (
    input: Omit<InsertValues<Table>, "sortOrder" | "code">
  ): Task<TableId, never, EvoluOwnerDep & EvoluDep> =>
  async (run) => {
    const [last] = await run.deps.evolu.loadQuery(lastTableSortOrderQuery)

    return ok(
      await run.ok(
        createTable({
          ...input,
          sortOrder: getNextSortOrder(last),
          code: generateTableCode(),
        })
      )
    )
  }

export const updateTable =
  (
    input: UpdateValues<Table>
  ): Task<TableId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update("table", removeUndefinedValues(input), {
        ...options,
        owner: evoluOwner,
      })
    )
    return ok(input.id)
  }

export const regenerateTableSelfPayQr =
  (
    table: Pick<TableRow, "id" | "selfPayEpoch">
  ): Task<TableId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { id } = table
    const selfPayEpoch = NonNegativeInteger((table.selfPayEpoch ?? 0) + 1)

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "table",
        { id, selfPayEpoch },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok(id)
  }

export const requestTableSelfPayPublish =
  (id: TableId): Task<TableId, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "table",
        {
          id,
          selfPayPublishRequestedAt: TimestampMs(run.deps.date.now().getTime()),
        },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok(id)
  }

const createTableHasOpenBillsError = defineError("TableHasOpenBills")<{
  readonly id: TableId
  readonly openBillCount: number
}>()
export type TableHasOpenBillsError = ReturnType<
  typeof createTableHasOpenBillsError
>

/**
 * Soft-deletes a table, refusing while an open bill is still assigned to it.
 * The POS floor view lists non-deleted tables plus the bills with no table
 * at all, so deleting an occupied table would strand its bill with no tile
 * to reach it from. Staff has to close the bill or move it to another table
 * first — the bill is money, the table is only where it sits.
 */
export const deleteTable =
  (
    id: TableId
  ): Task<TableId, TableHasOpenBillsError, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    const openBills = await run.deps.evolu.loadQuery(
      openBillsByTableIdQuery(id)
    )
    if (openBills.length > 0) {
      return err(
        createTableHasOpenBillsError({ id, openBillCount: openBills.length })
      )
    }

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "table",
        { id, isDeleted: sqliteTrue },
        {
          ...options,
          owner: evoluOwner,
        }
      )
    )
    return ok(id)
  }

export const listTables =
  (): Task<ReadonlyArray<TableRow>, never, EvoluDep> => async (run) =>
    ok(await run.deps.evolu.loadQuery(tablesQuery))
