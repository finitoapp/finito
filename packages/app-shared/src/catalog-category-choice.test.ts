import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"

import {
  type CategoryChoice,
  categoryChoiceLabel,
  categoryOptions,
} from "./catalog-category-choice.ts"

const drinks = "drinks" as CatalogCategoryId
const desserts = "desserts" as CatalogCategoryId
const categories = [
  { id: drinks, name: "Nápoje" },
  { id: desserts, name: "Dezerty" },
]
const none: CategoryChoice = { kind: "none" }

const options = (query: string, selected: CategoryChoice = none) =>
  categoryOptions({
    categories,
    query,
    selected,
    noneLabel: "No category",
    addLabel: (name) => `Add “${name}”`,
  }).map((option) => [option.label, option.choice])

describe("the category combobox (catalog/0004)", () => {
  test("lists no category and every category while nothing is typed", () => {
    expect(options("")).toEqual([
      ["No category", { kind: "none" }],
      ["Nápoje", { kind: "existing", id: drinks }],
      ["Dezerty", { kind: "existing", id: desserts }],
    ])
  })

  test("filters by what is typed, case and diacritics aside, and offers to add it", () => {
    expect(options("NAP")).toEqual([
      ["Nápoje", { kind: "existing", id: drinks }],
      ["Add “NAP”", { kind: "new", name: "NAP" }],
    ])
  })

  test("offers no second category for a name one already spells", () => {
    expect(options(" nápoje ")).toEqual([
      ["Nápoje", { kind: "existing", id: drinks }],
    ])
  })

  test("adds the name when nothing matches", () => {
    expect(options("Snacks")).toEqual([
      ["Add “Snacks”", { kind: "new", name: "Snacks" }],
    ])
  })

  test("keeps a typed name waiting for the item's save as a row", () => {
    const snacks: CategoryChoice = {
      kind: "new",
      name: NonEmptyString255("Snacks"),
    }

    expect(options("", snacks)).toEqual([
      ["No category", { kind: "none" }],
      ["Nápoje", { kind: "existing", id: drinks }],
      ["Dezerty", { kind: "existing", id: desserts }],
      ["Snacks", snacks],
    ])
    expect(options("snacks", snacks)).toEqual([["Snacks", snacks]])
  })

  test("shows a deleted category as none", () => {
    expect(
      categoryChoiceLabel({
        choice: { kind: "existing", id: "gone" as CatalogCategoryId },
        categories,
        noneLabel: "No category",
      })
    ).toBe("No category")
  })
})
