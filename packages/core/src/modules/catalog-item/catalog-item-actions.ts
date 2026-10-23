import {
  type InsertValues,
  ok,
  sqliteTrue,
  type Task,
  type UpdateValues,
} from "@evolu/common"

import type { EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  getNextSortOrder,
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import type { CatalogItem } from "./catalog-item.ts"
import { lastCatalogItemSortOrderQuery } from "./catalog-item-queries.ts"
import type { CatalogItemId } from "./catalog-item-types.ts"

/** A catalog item that is not there, for whoever looked it up. */
export const createCatalogItemNotFoundError = defineError(
  "CatalogItemNotFound"
)<{
  readonly id: CatalogItemId
}>()
export type CatalogItemNotFoundError = ReturnType<
  typeof createCatalogItemNotFoundError
>

export const createCatalogItem =
  (
    input: InsertValues<CatalogItem>
  ): Task<CatalogItemId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps
    const { id } = await runMutationWithCompletion((options) =>
      run.deps.evolu.insert(
        "catalogItem",
        removeUndefinedValues({
          deviceId: input.deviceId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          internalName: input.internalName,
          internalDescription: input.internalDescription,
          sku: input.sku,
          currency: input.currency,
          unitAmount: input.unitAmount,
          sortOrder: input.sortOrder,
          scanCode: input.scanCode,
          taxRateId: input.taxRateId,
        }),
        { ...options, owner: evoluOwner }
      )
    )
    return ok(id)
  }

export const updateCatalogItem =
  (
    input: UpdateValues<CatalogItem>
  ): Task<CatalogItemId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update("catalogItem", removeUndefinedValues(input), {
        ...options,
        owner: evoluOwner,
      })
    )
    return ok(input.id)
  }

/**
 * Creates a catalog item appended after the current last one, deriving
 * `sortOrder` from the highest existing value instead of taking it as input.
 * There is no reorder UI yet, so this is the only way callers assign
 * `sortOrder` when adding a new item.
 */
export const createCatalogItemAtEnd =
  (
    input: Omit<InsertValues<CatalogItem>, "sortOrder">
  ): Task<CatalogItemId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const [last] = await run.deps.evolu.loadQuery(lastCatalogItemSortOrderQuery)

    return ok(
      await run.ok(
        createCatalogItem({
          ...input,
          sortOrder: getNextSortOrder(last),
        })
      )
    )
  }

export const deleteCatalogItem =
  (id: CatalogItemId): Task<CatalogItemId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "catalogItem",
        { id, isDeleted: sqliteTrue },
        {
          ...options,
          owner: evoluOwner,
        }
      )
    )
    return ok(id)
  }

export const setCatalogItemInMenu = ({
  id,
  inMenu,
}: {
  readonly id: CatalogItemId
  readonly inMenu: boolean
}): Task<CatalogItemId, never, EvoluDep & EvoluOwnerDep> =>
  updateCatalogItem({ id, inMenu: inMenu ? sqliteTrue : null })

export const setCatalogItemSoldOut = ({
  id,
  soldOut,
}: {
  readonly id: CatalogItemId
  readonly soldOut: boolean
}): Task<CatalogItemId, never, EvoluDep & EvoluOwnerDep> =>
  updateCatalogItem({ id, soldOut: soldOut ? sqliteTrue : null })
