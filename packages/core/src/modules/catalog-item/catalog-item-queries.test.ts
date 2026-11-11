import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { EvoluOwnerDep } from "../../deps.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import {
  createCatalogCategory,
  deleteCatalogCategory,
} from "../catalog-category/catalog-category-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { NonEmptyString255, NonNegativeInteger } from "../shared/schema.ts"
import { createCatalogItemAtEnd } from "./catalog-item-actions.ts"
import {
  catalogItemsPageQuery,
  catalogItemUsedCategoryIdsQuery,
} from "./catalog-item-queries.ts"

describe("catalogItemsPageQuery", () => {
  test("filters by search text in SQL, ignoring case and diacritics", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const beerId = await run.orThrow(
      createCatalogItemAtEnd({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Pívo Ležák"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(4900),
        scanCode: null,
      })
    )
    await run.orThrow(
      createCatalogItemAtEnd({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Coffee"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(5900),
        scanCode: null,
      })
    )

    await expect
      .poll(() =>
        evolu.loadQuery(
          catalogItemsPageQuery({
            search: "PIVO",
            categoryFilter: "all",
            limit: 10,
          })
        )
      )
      .toMatchObject([{ id: beerId }])

    await expect
      .poll(() =>
        evolu.loadQuery(
          catalogItemsPageQuery({
            search: "žák",
            categoryFilter: "all",
            limit: 10,
          })
        )
      )
      .toMatchObject([{ id: beerId }])
  }, 15_000)

  test("filters by category in SQL", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const uncategorizedId = await run.orThrow(
      createCatalogItemAtEnd({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Loose item"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(1900),
        scanCode: null,
      })
    )

    await expect
      .poll(() =>
        evolu.loadQuery(
          catalogItemsPageQuery({
            search: "",
            categoryFilter: "uncategorized",
            limit: 10,
          })
        )
      )
      .toMatchObject([{ id: uncategorizedId }])

    await expect
      .poll(() =>
        evolu.loadQuery(
          catalogItemsPageQuery({
            search: "",
            categoryFilter: "all",
            limit: 10,
          })
        )
      )
      .toMatchObject([{ id: uncategorizedId }])
  }, 15_000)

  test("limits the number of rows returned for pagination", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    for (let index = 0; index < 5; index++) {
      await run.orThrow(
        createCatalogItemAtEnd({
          deviceId: null,
          categoryId: null,
          name: NonEmptyString255(`Item ${index}`),
          description: null,
          currency: "CZK",
          unitAmount: NonNegativeInteger(1000),
          scanCode: null,
        })
      )
    }

    await expect
      .poll(
        async () =>
          (
            await evolu.loadQuery(
              catalogItemsPageQuery({
                search: "",
                categoryFilter: "all",
                limit: 3,
              })
            )
          ).length
      )
      .toBe(3)

    await expect
      .poll(
        async () =>
          (
            await evolu.loadQuery(
              catalogItemsPageQuery({
                search: "",
                categoryFilter: "all",
                limit: 100,
              })
            )
          ).length
      )
      .toBe(5)
  }, 15_000)
  test("groups items by category order, the uncategorized last", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const drinksId = await run.ok(
      createCatalogCategory({
        deviceId: null,
        name: NonEmptyString255("Drinks"),
        sortOrder: NonNegativeInteger(1),
      })
    )
    const foodId = await run.ok(
      createCatalogCategory({
        deviceId: null,
        name: NonEmptyString255("Food"),
        sortOrder: NonNegativeInteger(0),
      })
    )
    const deletedId = await run.ok(
      createCatalogCategory({
        deviceId: null,
        name: NonEmptyString255("Gone"),
        sortOrder: NonNegativeInteger(0),
      })
    )
    await run.ok(deleteCatalogCategory(deletedId))

    const createItem = (name: string, categoryId: typeof drinksId | null) =>
      run.orThrow(
        createCatalogItemAtEnd({
          deviceId: null,
          categoryId,
          name: NonEmptyString255(name),
          description: null,
          currency: "CZK",
          unitAmount: NonNegativeInteger(1000),
          scanCode: null,
        })
      )
    const water = await createItem("Water", drinksId)
    const loose = await createItem("Loose", null)
    const soup = await createItem("Soup", foodId)
    const beer = await createItem("Beer", drinksId)
    const orphan = await createItem("Orphan", deletedId)
    const cake = await createItem("Cake", foodId)

    const loadIds = async (groupByCategory: boolean) =>
      (
        await evolu.loadQuery(
          catalogItemsPageQuery({
            search: "",
            categoryFilter: "all",
            groupByCategory,
            limit: 10,
          })
        )
      ).map((row) => row.id)

    await expect
      .poll(() => loadIds(true))
      .toEqual([soup, cake, water, beer, loose, orphan])
    await expect
      .poll(() => loadIds(false))
      .toEqual([water, loose, soup, beer, orphan, cake])
  }, 15_000)
})

describe("catalogItemUsedCategoryIdsQuery", () => {
  test("returns a row for uncategorized items", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    await expect
      .poll(() => evolu.loadQuery(catalogItemUsedCategoryIdsQuery))
      .toEqual([])

    await run.orThrow(
      createCatalogItemAtEnd({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Coffee"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(5900),
        scanCode: null,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogItemUsedCategoryIdsQuery))
      .toMatchObject([{ categoryId: null }])
  }, 15_000)
})
