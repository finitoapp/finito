import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { EvoluOwnerDep } from "../../deps.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { NonEmptyString255, NonNegativeInteger } from "../shared/schema.ts"
import {
  createCatalogCategory,
  createCatalogCategoryAtEnd,
  deleteCatalogCategory,
  findOrCreateCatalogCategory,
  updateCatalogCategory,
} from "./catalog-category-actions.ts"
import {
  catalogCategoriesQuery,
  catalogCategoryByIdQuery,
} from "./catalog-category-queries.ts"

describe("catalog category actions", () => {
  test("creates and updates a catalog category through real Evolu", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.ok(
      createCatalogCategory({
        deviceId: null,
        name: NonEmptyString255("Drinks"),
        sortOrder: NonNegativeInteger(10),
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogCategoryByIdQuery(id)))
      .toMatchObject([
        {
          id,
          deviceId: null,
          name: "Drinks",
          sortOrder: 10,
        },
      ])

    expect(
      await run.ok(
        updateCatalogCategory({
          id,
          name: NonEmptyString255("Beverages"),
          sortOrder: undefined,
        })
      )
    ).toBe(id)

    await expect
      .poll(() => evolu.loadQuery(catalogCategoryByIdQuery(id)))
      .toMatchObject([
        {
          id,
          deviceId: null,
          name: "Beverages",
          sortOrder: 10,
        },
      ])
  }, 15_000)

  test("appends catalog categories with an increasing sortOrder", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const firstId = await run.ok(
      createCatalogCategoryAtEnd({
        deviceId: null,
        name: NonEmptyString255("Drinks"),
      })
    )
    const secondId = await run.ok(
      createCatalogCategoryAtEnd({
        deviceId: null,
        name: NonEmptyString255("Food"),
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogCategoriesQuery))
      .toMatchObject([
        { id: firstId, sortOrder: 0 },
        { id: secondId, sortOrder: 1 },
      ])
  }, 15_000)

  test("soft-deletes a catalog category and hides it from queries", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.ok(
      createCatalogCategory({
        deviceId: null,
        name: NonEmptyString255("Drinks"),
        sortOrder: NonNegativeInteger(0),
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogCategoriesQuery))
      .toMatchObject([{ id }])

    expect(await run.ok(deleteCatalogCategory(id))).toBe(id)

    await expect.poll(() => evolu.loadQuery(catalogCategoriesQuery)).toEqual([])
  }, 15_000)
})

describe("a category is made on the item (navigation/0003)", () => {
  test("creates the category the first time and reuses it by name afterwards", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.ok(
      findOrCreateCatalogCategory(NonEmptyString255("Drinks"))
    )
    await expect
      .poll(() => evolu.loadQuery(catalogCategoriesQuery))
      .toMatchObject([{ id, name: "Drinks", sortOrder: 0 }])

    expect(
      await run.ok(findOrCreateCatalogCategory(NonEmptyString255(" drinks ")))
    ).toBe(id)
    const other = await run.ok(
      findOrCreateCatalogCategory(NonEmptyString255("Snacks"))
    )
    expect(other).not.toBe(id)
    await expect
      .poll(() => evolu.loadQuery(catalogCategoriesQuery))
      .toMatchObject([
        { id, name: "Drinks" },
        { id: other, name: "Snacks", sortOrder: 1 },
      ])
  }, 15_000)
})
