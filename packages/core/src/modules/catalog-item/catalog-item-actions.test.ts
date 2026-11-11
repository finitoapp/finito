import { type Run, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { EvoluOwnerDep } from "../../deps.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { setLegalEntity } from "../legal-entity/legal-entity-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
} from "../shared/schema.ts"
import { createTaxRate } from "../tax-rate/tax-rate-actions.ts"
import { TaxRatePercentage } from "../tax-rate/tax-rate-types.ts"
import {
  createCatalogItem,
  createCatalogItemAtEnd,
  deleteCatalogItem,
  updateCatalogItem,
} from "./catalog-item-actions.ts"
import {
  catalogItemByIdQuery,
  catalogItemsQuery,
} from "./catalog-item-queries.ts"

describe("catalog item actions", () => {
  test("creates and updates a catalog item through real Evolu", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.orThrow(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Coffee"),
        description: NonEmptyString255("Double espresso"),
        internalName: NonEmptyString255("COF-01"),
        internalDescription: NonEmptyString255("Uses the cheap beans"),
        sku: NonEmptyString255("SKU-001"),
        currency: "CZK",
        unitAmount: NonNegativeInteger(5900),
        sortOrder: NonNegativeInteger(10),
        scanCode: null,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogItemByIdQuery(id)))
      .toMatchObject([
        {
          id,
          deviceId: null,
          name: "Coffee",
          description: "Double espresso",
          internalName: "COF-01",
          internalDescription: "Uses the cheap beans",
          sku: "SKU-001",
          currency: "CZK",
          unitAmount: 5900,
          sortOrder: 10,
          scanCode: null,
        },
      ])

    expect(
      await run.orThrow(
        updateCatalogItem({
          id,
          name: NonEmptyString255("Espresso"),
          description: null,
          internalName: null,
          internalDescription: null,
          sku: null,
          currency: undefined,
          unitAmount: NonNegativeInteger(6900),
          sortOrder: undefined,
        })
      )
    ).toBe(id)

    await expect
      .poll(() => evolu.loadQuery(catalogItemByIdQuery(id)))
      .toMatchObject([
        {
          id,
          deviceId: null,
          name: "Espresso",
          description: null,
          internalName: null,
          internalDescription: null,
          sku: null,
          currency: "CZK",
          unitAmount: 6900,
          sortOrder: 10,
          scanCode: null,
        },
      ])
  }, 15_000)

  test("persists and clears a scan code", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.orThrow(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Coffee"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(5900),
        sortOrder: NonNegativeInteger(0),
        scanCode: NonEmptyString255("8594001234567"),
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogItemByIdQuery(id)))
      .toMatchObject([{ id, scanCode: "8594001234567" }])

    await run.orThrow(
      updateCatalogItem({
        id,
        scanCode: NonEmptyString255("8594007654321"),
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogItemByIdQuery(id)))
      .toMatchObject([{ id, scanCode: "8594007654321" }])

    await run.orThrow(updateCatalogItem({ id, scanCode: null }))

    await expect
      .poll(() => evolu.loadQuery(catalogItemByIdQuery(id)))
      .toMatchObject([{ id, scanCode: null }])
  }, 15_000)

  test("appends catalog items with an increasing sortOrder", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const firstId = await run.orThrow(
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
    const secondId = await run.orThrow(
      createCatalogItemAtEnd({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Tea"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(4900),
        scanCode: null,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogItemsQuery))
      .toMatchObject([
        { id: firstId, sortOrder: 0 },
        { id: secondId, sortOrder: 1 },
      ])
  }, 15_000)

  test("appends past a two-digit sortOrder", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    // 10 after 9, the pair a lexical comparison gets backwards ("9" > "10"),
    // which would append the next item at 10 — on top of an item already
    // there. `sortOrder` lives in an `any` column, so its storage type does
    // not settle which comparison SQLite applies; the tests above stop at
    // single digits, where the two agree.
    for (const [name, sortOrder] of [
      ["Ninth", 9],
      ["Tenth", 10],
    ] as const) {
      await run.orThrow(
        createCatalogItem({
          deviceId: null,
          categoryId: null,
          name: NonEmptyString255(name),
          description: null,
          currency: "CZK",
          unitAmount: NonNegativeInteger(5900),
          sortOrder: NonNegativeInteger(sortOrder),
          scanCode: null,
        })
      )
    }

    const appendedId = await run.orThrow(
      createCatalogItemAtEnd({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Eleventh"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(4900),
        scanCode: null,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogItemByIdQuery(appendedId)))
      .toMatchObject([{ id: appendedId, sortOrder: 11 }])
  }, 15_000)

  test("appends over a deleted item's sortOrder", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    // Deleting the last item frees its `sortOrder` for the next one, because
    // the highest value is read over non-deleted items only. Harmless — order
    // is presentational here, unlike a bill's `displayNumber` — but it is the
    // behaviour, and it is what says the predicates behind the highest-value
    // lookup still match the listing's.
    const firstId = await run.orThrow(
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
    const deletedId = await run.orThrow(
      createCatalogItemAtEnd({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Tea"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(4900),
        scanCode: null,
      })
    )
    await run.ok(deleteCatalogItem(deletedId))

    const appendedId = await run.orThrow(
      createCatalogItemAtEnd({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Cocoa"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(3900),
        scanCode: null,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogItemsQuery))
      .toMatchObject([
        { id: firstId, sortOrder: 0 },
        { id: appendedId, sortOrder: 1 },
      ])
  }, 15_000)

  test("soft-deletes a catalog item and hides it from queries", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.orThrow(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Coffee"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(5900),
        sortOrder: NonNegativeInteger(0),
        scanCode: null,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(catalogItemsQuery))
      .toMatchObject([{ id }])

    expect(await run.ok(deleteCatalogItem(id))).toBe(id)

    await expect.poll(() => evolu.loadQuery(catalogItemsQuery)).toEqual([])
  }, 15_000)
})

describe("catalog item pricing", () => {
  /** Sets the account's VAT payer flag and creates one VAT rate. */
  const setUpPricing = async (
    run: Run<EvoluDep & EvoluOwnerDep>,
    vatPayer: boolean
  ) => {
    await run.ok(setLegalEntity({ country: "CZ", vatPayer }))
    return run.ok(
      createTaxRate({
        name: NonEmptyString255("Standard"),
        rate: TaxRatePercentage(2100),
        isDefault: true,
      })
    )
  }

  const water = {
    deviceId: null,
    categoryId: null,
    name: NonEmptyString255("Tap water"),
    description: null,
    currency: "CZK",
    unitAmount: NonNegativeInteger(0),
    scanCode: null,
  } as const

  test("a VAT payer cannot save a zero-priced item without a VAT rate", async () => {
    await using testEvolu = await createEvoluTest()
    const deps = {
      ...evoluTestDeps(testEvolu.evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const taxRateId = await setUpPricing(run, true)

    await expect(
      run(createCatalogItemAtEnd({ ...water, taxRateId: null }))
    ).resolves.toEqual({
      ok: false,
      error: { type: "ZeroPriceWithoutTaxRate" },
    })

    const id = await run.orThrow(
      createCatalogItemAtEnd({ ...water, taxRateId })
    )
    // Neither clearing the rate of a free item nor making an item without a
    // rate free gets past the rule.
    await expect(
      run(updateCatalogItem({ id, taxRateId: null }))
    ).resolves.toEqual({
      ok: false,
      error: { type: "ZeroPriceWithoutTaxRate" },
    })
    const coffee = await run.orThrow(
      createCatalogItemAtEnd({
        ...water,
        name: NonEmptyString255("Coffee"),
        unitAmount: NonNegativeInteger(5_900),
        taxRateId: null,
      })
    )
    await expect(
      run(updateCatalogItem({ id: coffee, unitAmount: NonNegativeInteger(0) }))
    ).resolves.toEqual({
      ok: false,
      error: { type: "ZeroPriceWithoutTaxRate" },
    })
    await expect(
      run(
        updateCatalogItem({
          id: coffee,
          unitAmount: NonNegativeInteger(0),
          taxRateId,
        })
      )
    ).resolves.toEqual({ ok: true, value: coffee })
  }, 15_000)

  test("an account that is not a VAT payer saves a zero-priced item without a VAT rate", async () => {
    await using testEvolu = await createEvoluTest()
    const deps = {
      ...evoluTestDeps(testEvolu.evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    await setUpPricing(run, false)

    const id = await run.orThrow(
      createCatalogItemAtEnd({ ...water, taxRateId: null })
    )

    await expect
      .poll(() => testEvolu.evolu.loadQuery(catalogItemByIdQuery(id)))
      .toMatchObject([{ id, unitAmount: 0, taxRateId: null }])
  }, 15_000)

  test("an update that touches neither the price nor the rate is not judged", async () => {
    await using testEvolu = await createEvoluTest()
    const deps = {
      ...evoluTestDeps(testEvolu.evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    await setUpPricing(run, false)
    const id = await run.orThrow(
      createCatalogItemAtEnd({ ...water, taxRateId: null })
    )
    // The account becomes a VAT payer after the free item was saved.
    await run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))

    await expect(
      run(updateCatalogItem({ id, name: NonEmptyString255("Still water") }))
    ).resolves.toEqual({ ok: true, value: id })
  }, 15_000)
})

describe("catalog item discounts", () => {
  const discount = {
    deviceId: null,
    categoryId: null,
    name: NonEmptyString255("Loyalty discount"),
    description: null,
    currency: "CZK",
    unitAmount: Integer(-5_000),
    scanCode: null,
  } as const

  test("a discount with a VAT rate cannot be saved", async () => {
    await using testEvolu = await createEvoluTest()
    const deps = {
      ...evoluTestDeps(testEvolu.evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    await run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))
    const taxRateId = await run.ok(
      createTaxRate({
        name: NonEmptyString255("Standard"),
        rate: TaxRatePercentage(2100),
        isDefault: true,
      })
    )

    await expect(
      run(createCatalogItemAtEnd({ ...discount, taxRateId }))
    ).resolves.toEqual({ ok: false, error: { type: "DiscountWithTaxRate" } })

    const id = await run.orThrow(
      createCatalogItemAtEnd({ ...discount, taxRateId: null })
    )
    await expect
      .poll(() => testEvolu.evolu.loadQuery(catalogItemByIdQuery(id)))
      .toMatchObject([{ id, unitAmount: -5_000, taxRateId: null }])

    // An update of the rate alone is judged against the stored price.
    await expect(run(updateCatalogItem({ id, taxRateId }))).resolves.toEqual({
      ok: false,
      error: { type: "DiscountWithTaxRate" },
    })
  }, 15_000)

  test("an update cannot change the sign of a price", async () => {
    await using testEvolu = await createEvoluTest()
    const deps = {
      ...evoluTestDeps(testEvolu.evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    await run.ok(setLegalEntity({ country: "CZ", vatPayer: false }))

    const discountId = await run.orThrow(
      createCatalogItemAtEnd({ ...discount, taxRateId: null })
    )
    const coffee = await run.orThrow(
      createCatalogItemAtEnd({
        ...discount,
        name: NonEmptyString255("Coffee"),
        unitAmount: Integer(5_900),
        taxRateId: null,
      })
    )
    const signChange = {
      ok: false,
      error: { type: "CatalogItemPriceSignChange" },
    }

    await expect(
      run(updateCatalogItem({ id: discountId, unitAmount: Integer(5_000) }))
    ).resolves.toEqual(signChange)
    await expect(
      run(updateCatalogItem({ id: discountId, unitAmount: Integer(0) }))
    ).resolves.toEqual(signChange)
    await expect(
      run(updateCatalogItem({ id: coffee, unitAmount: Integer(-5_900) }))
    ).resolves.toEqual(signChange)

    // The amount of a discount may still change, as long as it stays one.
    await expect(
      run(updateCatalogItem({ id: discountId, unitAmount: Integer(-7_500) }))
    ).resolves.toEqual({ ok: true, value: discountId })
    await expect
      .poll(() => testEvolu.evolu.loadQuery(catalogItemByIdQuery(discountId)))
      .toMatchObject([{ unitAmount: -7_500 }])
  }, 15_000)
})
