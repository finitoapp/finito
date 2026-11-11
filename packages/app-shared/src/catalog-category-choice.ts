import { ok, type Task } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { EvoluOwnerDep } from "@payky/core/deps"
import {
  type CatalogCategoryNameTakenError,
  findOrCreateCatalogCategory,
} from "@payky/core/modules/catalog-category/catalog-category-actions"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { sameCategoryName } from "@payky/core/modules/catalog-category/catalog-category-utils"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import {
  type NonEmptyString255,
  NonEmptyString255Schema,
} from "@payky/core/modules/shared/schema"
import { foldDiacritics } from "@payky/core/utils/sql-text-search"

/**
 * What an item's category combobox holds (catalog/0004): no category, one
 * that exists, or a typed name that becomes a category when the item is
 * saved (`resolveCategoryChoice`).
 */
export type CategoryChoice =
  | { readonly kind: "none" }
  | { readonly kind: "existing"; readonly id: CatalogCategoryId }
  | { readonly kind: "new"; readonly name: NonEmptyString255 }

/** One row of the combobox: `key` is unique and stable across renders. */
export interface CategoryOption {
  readonly key: string
  /** What the row reads and what the field shows once it is chosen. */
  readonly label: string
  readonly choice: CategoryChoice
}

const noCategory: CategoryChoice = { kind: "none" }

/** The choice an item's stored `categoryId` stands for. */
export const categoryChoiceOf = (
  categoryId: CatalogCategoryId | null
): CategoryChoice =>
  categoryId === null ? noCategory : { kind: "existing", id: categoryId }

/** The key of the option `choice` is, to mark it as selected. */
export const categoryChoiceKey = (choice: CategoryChoice): string => {
  switch (choice.kind) {
    case "none":
      return "none"
    case "existing":
      return `category:${choice.id}`
    case "new":
      return `new:${choice.name}`
  }
}

/**
 * The combobox's rows for what is typed (catalog/0004): with nothing typed,
 * "no category" and every category in its order; with a query, the
 * categories whose name contains it, case and diacritics aside, and last a
 * row adding the typed name unless a category already spells it. A typed
 * name still waiting to be saved (`selected` of kind `new`) stays a row of
 * its own, so the field can show it.
 */
export const categoryOptions = ({
  categories,
  query,
  selected,
  noneLabel,
  addLabel,
}: {
  readonly categories: ReadonlyArray<{
    readonly id: CatalogCategoryId
    readonly name: string
  }>
  readonly query: string
  readonly selected: CategoryChoice
  readonly noneLabel: string
  /** The label of the row adding `name`, "Add “{name}”". */
  readonly addLabel: (name: string) => string
}): ReadonlyArray<CategoryOption> => {
  const term = foldDiacritics(query.trim())
  const matching = categories.filter((category) =>
    foldDiacritics(category.name).includes(term)
  )
  const existing = matching.map(
    (category): CategoryOption => ({
      key: `category:${category.id}`,
      label: category.name,
      choice: { kind: "existing", id: category.id },
    })
  )
  const pending: ReadonlyArray<CategoryOption> =
    selected.kind === "new" && foldDiacritics(selected.name).includes(term)
      ? [
          {
            key: categoryChoiceKey(selected),
            label: selected.name,
            choice: selected,
          },
        ]
      : []

  if (term === "") {
    return [
      { key: "none", label: noneLabel, choice: noCategory },
      ...existing,
      ...pending,
    ]
  }

  const name = NonEmptyString255Schema.safeParse(query.trim())
  const taken =
    !name.success ||
    categories.some((category) => sameCategoryName(category.name, query)) ||
    (selected.kind === "new" && sameCategoryName(selected.name, query))
  return [
    ...existing,
    ...pending,
    ...(taken
      ? []
      : [
          {
            key: `add:${name.data}`,
            label: addLabel(name.data),
            choice: { kind: "new", name: name.data } as const,
          },
        ]),
  ]
}

/**
 * The text the field shows for `choice`: the category's name, the typed
 * name, or `noneLabel`; a category deleted meanwhile reads as none.
 */
export const categoryChoiceLabel = ({
  choice,
  categories,
  noneLabel,
}: {
  readonly choice: CategoryChoice
  readonly categories: ReadonlyArray<{
    readonly id: CatalogCategoryId
    readonly name: string
  }>
  readonly noneLabel: string
}): string => {
  switch (choice.kind) {
    case "none":
      return noneLabel
    case "existing":
      return (
        categories.find((category) => category.id === choice.id)?.name ??
        noneLabel
      )
    case "new":
      return choice.name
  }
}

/**
 * The `categoryId` to save for `choice`: a typed name becomes the category
 * spelt that way, made the first time (`findOrCreateCatalogCategory`).
 */
export const resolveCategoryChoice =
  (
    choice: CategoryChoice
  ): Task<CatalogCategoryId | null, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    switch (choice.kind) {
      case "none":
        return ok(null)
      case "existing":
        return ok(choice.id)
      case "new":
        return ok(await run.ok(findOrCreateCatalogCategory(choice.name)))
    }
  }

/** The message for a rename `renameCatalogCategory` refuses (catalog/0004). */
export const renameCatalogCategoryErrorKeys = {
  CatalogCategoryNameTaken: "catalog.categories.form.name.taken",
} satisfies Record<CatalogCategoryNameTakenError["type"], TranslationKey>
