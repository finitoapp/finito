import {
  type InsertValues,
  ok,
  sqliteTrue,
  type Task,
  type UpdateValues,
} from "@evolu/common"

import type { EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import { legalEntityQuery } from "../legal-entity/legal-entity-queries.ts"
import { isVatPayer } from "../legal-entity/legal-entity-utils.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  getNextSortOrder,
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { getFirstOr } from "../shared/result.ts"
import type { CatalogItem } from "./catalog-item.ts"
import {
  catalogItemByIdQuery,
  lastCatalogItemSortOrderQuery,
} from "./catalog-item-queries.ts"
import type { CatalogItemId } from "./catalog-item-types.ts"
import {
  type CatalogItemPricingError,
  validateCatalogItemPricing,
} from "./catalog-item-utils.ts"

/** A catalog item that is not there, for whoever looked it up. */
export const createCatalogItemNotFoundError = defineError(
  "CatalogItemNotFound"
)<{
  readonly id: CatalogItemId
}>()
export type CatalogItemNotFoundError = ReturnType<
  typeof createCatalogItemNotFoundError
>

/** Whether the account is a VAT payer, for `validateCatalogItemPricing`. */
const loadVatPayer = (): Task<boolean, never, EvoluDep> => async (run) => {
  const [legalEntity] = await run.deps.evolu.loadQuery(legalEntityQuery)
  return ok(isVatPayer(legalEntity))
}

/**
 * Refuses a price and VAT rate that break `validateCatalogItemPricing`, so the
 * CLI keeps the rules the forms keep (catalog/0001, catalog/0002). A negative
 * `unitAmount` creates a discount.
 */
export const createCatalogItem =
  (
    input: InsertValues<CatalogItem>
  ): Task<CatalogItemId, CatalogItemPricingError, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const pricingResult = validateCatalogItemPricing({
      unitAmount: input.unitAmount,
      taxRateId: input.taxRateId ?? null,
      vatPayer: await run.ok(loadVatPayer()),
      originalUnitAmount: null,
    })
    if (!pricingResult.ok) return pricingResult

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

/**
 * An update that touches the price or the VAT rate is judged by
 * `validateCatalogItemPricing` against the item it leaves behind — the
 * stored half it does not change included, and its stored price is the
 * `originalUnitAmount` whose sign the new price must keep (catalog/0002). So
 * giving a discount a VAT rate is refused as surely as turning it into an
 * item. One that touches neither is not judged at all: renaming a
 * zero-priced item saved before its account became a VAT payer is not the
 * moment to refuse it (catalog/0001).
 */
export const updateCatalogItem =
  (
    input: UpdateValues<CatalogItem>
  ): Task<
    CatalogItemId,
    CatalogItemNotFoundError | CatalogItemPricingError,
    EvoluDep & EvoluOwnerDep
  > =>
  async (run) => {
    if (input.unitAmount !== undefined || input.taxRateId !== undefined) {
      const [catalogItemRows, vatPayer] = await Promise.all([
        run.deps.evolu.loadQuery(catalogItemByIdQuery(input.id)),
        run.ok(loadVatPayer()),
      ])
      const currentResult = getFirstOr(
        catalogItemRows,
        createCatalogItemNotFoundError({ id: input.id })
      )
      if (!currentResult.ok) return currentResult
      const current = currentResult.value

      const pricingResult = validateCatalogItemPricing({
        unitAmount: input.unitAmount ?? current.unitAmount,
        taxRateId:
          input.taxRateId === undefined ? current.taxRateId : input.taxRateId,
        vatPayer,
        originalUnitAmount: current.unitAmount,
      })
      if (!pricingResult.ok) return pricingResult
    }

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
  ): Task<CatalogItemId, CatalogItemPricingError, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const [last] = await run.deps.evolu.loadQuery(lastCatalogItemSortOrderQuery)

    return run(
      createCatalogItem({
        ...input,
        sortOrder: getNextSortOrder(last),
      })
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
