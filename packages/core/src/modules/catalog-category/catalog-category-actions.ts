import {
  err,
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
import type { NonEmptyString255 } from "../shared/schema.ts"
import type { CatalogCategory } from "./catalog-category.ts"
import {
  catalogCategoriesQuery,
  lastCatalogCategorySortOrderQuery,
} from "./catalog-category-queries.ts"
import type { CatalogCategoryId } from "./catalog-category-types.ts"
import { sameCategoryName } from "./catalog-category-utils.ts"

export const createCatalogCategory =
  (
    input: InsertValues<CatalogCategory>
  ): Task<CatalogCategoryId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps
    const { id } = await runMutationWithCompletion((options) =>
      run.deps.evolu.insert(
        "catalogCategory",
        removeUndefinedValues({
          deviceId: input.deviceId,
          name: input.name,
          sortOrder: input.sortOrder,
        }),
        { ...options, owner: evoluOwner }
      )
    )
    return ok(id)
  }

export const updateCatalogCategory =
  (
    input: UpdateValues<CatalogCategory>
  ): Task<CatalogCategoryId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update("catalogCategory", removeUndefinedValues(input), {
        ...options,
        owner: evoluOwner,
      })
    )
    return ok(input.id)
  }

/**
 * Creates a catalog category appended after the current last one, deriving
 * `sortOrder` from the highest existing value instead of taking it as input.
 * There is no reorder UI yet, so this is the only way callers assign
 * `sortOrder` when adding a new category.
 */
export const createCatalogCategoryAtEnd =
  (
    input: Omit<InsertValues<CatalogCategory>, "sortOrder">
  ): Task<CatalogCategoryId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const [last] = await run.deps.evolu.loadQuery(
      lastCatalogCategorySortOrderQuery
    )

    return ok(
      await run.ok(
        createCatalogCategory({
          ...input,
          sortOrder: getNextSortOrder(last),
        })
      )
    )
  }

export const deleteCatalogCategory =
  (
    id: CatalogCategoryId
  ): Task<CatalogCategoryId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "catalogCategory",
        { id, isDeleted: sqliteTrue },
        {
          ...options,
          owner: evoluOwner,
        }
      )
    )
    return ok(id)
  }

/**
 * The category called `name`, created at the end when there is none yet,
 * as Linky makes a contact group from the name typed on the contact
 * (navigation/0003): a category is made where it is first used, on an
 * item, not on a screen of its own. Returns the existing one when a name
 * differing only in case or surrounding spaces is already taken, so typing
 * "drinks" under "Drinks" adds no second category.
 */
export const findOrCreateCatalogCategory =
  (
    name: NonEmptyString255
  ): Task<CatalogCategoryId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const categories = await run.deps.evolu.loadQuery(catalogCategoriesQuery)
    const existing = categories.find((category) =>
      sameCategoryName(category.name, name)
    )
    if (existing !== undefined) return ok(existing.id)

    return ok(
      await run.ok(createCatalogCategoryAtEnd({ deviceId: null, name }))
    )
  }

const createCatalogCategoryNameTakenError = defineError(
  "CatalogCategoryNameTaken"
)<{ readonly id: CatalogCategoryId }>()
export type CatalogCategoryNameTakenError = ReturnType<
  typeof createCatalogCategoryNameTakenError
>

/**
 * Renames a category from the item it is chosen on (catalog/0004). A name
 * another category already spells, case and spaces aside, is refused with
 * that category's id rather than merged: two categories with one name
 * would be two chips nobody can tell apart, and merging them would move
 * items the merchant did not touch. Renaming to its own name in another
 * case is a rename.
 */
export const renameCatalogCategory =
  ({
    id,
    name,
  }: {
    readonly id: CatalogCategoryId
    readonly name: NonEmptyString255
  }): Task<
    CatalogCategoryId,
    CatalogCategoryNameTakenError,
    EvoluDep & EvoluOwnerDep
  > =>
  async (run) => {
    const categories = await run.deps.evolu.loadQuery(catalogCategoriesQuery)
    const taken = categories.find(
      (category) => category.id !== id && sameCategoryName(category.name, name)
    )
    if (taken !== undefined)
      return err(createCatalogCategoryNameTakenError({ id: taken.id }))

    return ok(await run.ok(updateCatalogCategory({ id, name })))
  }
