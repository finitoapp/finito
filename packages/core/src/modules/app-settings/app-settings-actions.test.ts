import { testCreateRun } from "@evolu/common"
import { describe, expect, test, vi } from "vitest"
import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { createTestDateDep, testFixedDate } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import {
  cardSwitchioAccountQuery,
  cashRegisterAccountQuery,
  cashuAccountQuery,
  fiatBankAccountQuery,
  sparkAccountQuery,
} from "../account/account-queries.ts"
import { catalogCategoriesQuery } from "../catalog-category/catalog-category-queries.ts"
import { catalogItemsQuery } from "../catalog-item/catalog-item-queries.ts"
import { setLegalEntity } from "../legal-entity/legal-entity-actions.ts"
import { legalEntityQuery } from "../legal-entity/legal-entity-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { MasterKey } from "../shared/key-derivation.ts"
import {
  BankAccountInputIbanSchema,
  NonEmptyString255,
  NonNegativeInteger,
} from "../shared/schema.ts"
import { createTaxRate } from "../tax-rate/tax-rate-actions.ts"
import {
  activeTaxRatesQuery,
  taxRatesQuery,
} from "../tax-rate/tax-rate-queries.ts"
import { TaxRatePercentage } from "../tax-rate/tax-rate-types.ts"
import {
  completeOnboarding,
  finishOnboarding,
  markRecoveryPhraseVerified,
  requireNotOnboarded,
  setEnabledHomeModes,
  setKeypadTaxRate,
  updateTipSettings,
} from "./app-settings-actions.ts"
import { settingsQuery } from "./app-settings-queries.ts"
import type { OnboardingStarterItem } from "./app-settings-types.ts"
import {
  createDefaultSettings,
  defaultPaymentMethod,
  defaultPaymentMethodOrder,
} from "./app-settings-utils.ts"

describe("tip settings actions", () => {
  test("persists each tip setting through Evolu", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.orThrow(
      completeOnboarding({
        fiatCurrency: "CZK",
        defaultPaymentMethod,
        paymentMethodOrderJson: JSON.stringify(defaultPaymentMethodOrder),
      })
    )
    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([
        expect.objectContaining({
          tipsEnabled: 1,
        }),
      ])
    await run.ok(
      updateTipSettings({
        enabled: false,
        percentages: [10, 20],
        fixedAmounts: [2500, 5000],
      })
    )

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([
        expect.objectContaining({
          tipsEnabled: 0,
          presetTipPercentagesJson: "[10,20]",
          presetTipFixedAmountsJson: "[2500,5000]",
        }),
      ])
  })
})

describe("setEnabledHomeModes", () => {
  const onboard = completeOnboarding({
    fiatCurrency: "CZK",
    defaultPaymentMethod,
    paymentMethodOrderJson: JSON.stringify(defaultPaymentMethodOrder),
  })

  test("an account onboarded without a mode leaves the home modes unset, which means all of them", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.orThrow(onboard)

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([expect.objectContaining({ enabledHomeModesJson: null })])
  })

  test("saves the enabled modes in their fixed order", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.orThrow(onboard)
    await run.orThrow(setEnabledHomeModes(["pos", "numpad", "pos"]))

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([
        expect.objectContaining({ enabledHomeModesJson: '["numpad","pos"]' }),
      ])
  })

  test("refuses to disable every mode and keeps the stored set", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.orThrow(onboard)
    await run.orThrow(setEnabledHomeModes(["pos"]))
    const result = await run(setEnabledHomeModes([]))

    expect(result).toEqual({
      ok: false,
      error: { type: "NoHomeModeEnabled" },
    })
    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([expect.objectContaining({ enabledHomeModesJson: '["pos"]' })])
  })
})

describe("setKeypadTaxRate", () => {
  const onboard = completeOnboarding({
    fiatCurrency: "CZK",
    defaultPaymentMethod,
    paymentMethodOrderJson: JSON.stringify(defaultPaymentMethodOrder),
  })

  test("a new account has no keypad tax rate", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.orThrow(onboard)

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([expect.objectContaining({ keypadTaxRateId: null })])
  })

  test("saves the rate and clears it again", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.orThrow(onboard)
    const taxRateId = await run.ok(
      createTaxRate({
        name: NonEmptyString255("Standard"),
        rate: TaxRatePercentage(2100),
        isDefault: false,
      })
    )

    await run.ok(setKeypadTaxRate(taxRateId))
    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([expect.objectContaining({ keypadTaxRateId: taxRateId })])

    await run.ok(setKeypadTaxRate(null))
    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([expect.objectContaining({ keypadTaxRateId: null })])
  })
})

describe("markRecoveryPhraseVerified", () => {
  const onboard = completeOnboarding({
    fiatCurrency: "CZK",
    defaultPaymentMethod,
    paymentMethodOrderJson: JSON.stringify(defaultPaymentMethodOrder),
  })

  test("a new account is unverified, and still onboarded", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.orThrow(onboard)

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([expect.objectContaining({ recoveryPhraseVerifiedAt: null })])
  })

  test("a settings row written without the column still counts as onboarded", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    // What an older app version syncs: the row has no recoveryPhraseVerifiedAt.
    const { recoveryPhraseVerifiedAt: _omitted, ...legacy } = {
      ...createDefaultSettings(),
      enabledHomeModesJson: null,
      recoveryPhraseVerifiedAt: null,
    }
    evolu.upsert("appSettings", legacy, { owner: evolu.appOwner })

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([expect.objectContaining({ recoveryPhraseVerifiedAt: null })])
    await expect(run(requireNotOnboarded())).resolves.toMatchObject({
      ok: false,
    })
  })

  test("writes the stamp and stays verified when run again", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps: EvoluDep & EvoluOwnerDep & DateDep = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    }
    await using run = testCreateRun(deps)

    await run.orThrow(onboard)
    await run.ok(markRecoveryPhraseVerified())
    await run.ok(markRecoveryPhraseVerified())

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([
        expect.objectContaining({
          recoveryPhraseVerifiedAt: testFixedDate.getTime(),
        }),
      ])
  })
})

const input = {
  country: "CZ",
  currency: "CZK",
  iban: BankAccountInputIbanSchema.parse("CZ6508000000192000145399"),
  defaultPaymentMethod,
  paymentMethodOrderJson: JSON.stringify(defaultPaymentMethodOrder),
  homeMode: "numpad",
  tipsEnabled: true,
  cardSwitchio: false,
} as const

describe("finishOnboarding", () => {
  test("offers home only the mode the merchant chose and keeps their tips choice", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
    })

    await run.orThrow(
      finishOnboarding({ ...input, homeMode: "pos", tipsEnabled: false })
    )

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([
        expect.objectContaining({
          enabledHomeModesJson: '["pos"]',
          tipsEnabled: 0,
        }),
      ])
  })

  test("starts with tips on when the merchant leaves them on", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
    })

    await run.orThrow(finishOnboarding(input))

    await expect
      .poll(() => evolu.loadQuery(settingsQuery))
      .toEqual([
        expect.objectContaining({
          enabledHomeModesJson: '["numpad"]',
          tipsEnabled: 1,
        }),
      ])
  })

  test("enables cash and Spark without a bank account and leaves Cashu disabled", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
    })
    await run.orThrow(finishOnboarding({ ...input, iban: null }))
    await expect
      .poll(() => evolu.loadQuery(cashRegisterAccountQuery))
      .toEqual([expect.objectContaining({ isDeleted: 0, currency: "CZK" })])
    await expect
      .poll(() => evolu.loadQuery(sparkAccountQuery))
      .toEqual([expect.objectContaining({ isDeleted: 0 })])
    expect(await evolu.loadQuery(fiatBankAccountQuery)).toEqual([])
    expect(await evolu.loadQuery(cashuAccountQuery)).toEqual([])
  })

  test("enables the card terminal in the account's currency when SwitchioPay was found", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
    })
    await run.orThrow(finishOnboarding({ ...input, cardSwitchio: true }))
    await expect
      .poll(() => evolu.loadQuery(cardSwitchioAccountQuery))
      .toEqual([expect.objectContaining({ isDeleted: 0, currency: "CZK" })])
  })

  test("leaves the card terminal off when SwitchioPay was not found", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
    })
    await run.orThrow(finishOnboarding(input))
    await expect.poll(() => evolu.loadQuery(settingsQuery)).toHaveLength(1)
    expect(await evolu.loadQuery(cardSwitchioAccountQuery)).toEqual([])
  })

  test("writes the account's first settings", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
    })

    await expect(run(finishOnboarding(input))).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect.poll(() => evolu.loadQuery(settingsQuery)).toHaveLength(1)
  })

  test("writes no row on an onboarded account", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
    })
    await run.orThrow(
      completeOnboarding({
        fiatCurrency: "EUR",
        defaultPaymentMethod,
        paymentMethodOrderJson: JSON.stringify(defaultPaymentMethodOrder),
      })
    )

    await expect(run(finishOnboarding(input))).resolves.toEqual({
      ok: false,
      error: { type: "AlreadyOnboarded" },
    })

    const [settings, legalEntity, taxRates, cash, spark, bank] =
      await Promise.all([
        evolu.loadQuery(settingsQuery),
        evolu.loadQuery(legalEntityQuery),
        evolu.loadQuery(taxRatesQuery),
        evolu.loadQuery(cashRegisterAccountQuery),
        evolu.loadQuery(sparkAccountQuery),
        evolu.loadQuery(fiatBankAccountQuery),
      ])
    expect(settings).toEqual([expect.objectContaining({ fiatCurrency: "EUR" })])
    expect([legalEntity, taxRates, cash, spark, bank]).toEqual([
      [],
      [],
      [],
      [],
      [],
    ])
  })
})

describe("finishOnboarding starter items", () => {
  const starterItem = ({
    name,
    unitAmount,
    categoryName,
    taxRatePercentage,
  }: {
    readonly name: string
    readonly unitAmount: number
    readonly categoryName: string | null
    readonly taxRatePercentage: number | null
  }): OnboardingStarterItem => ({
    name: NonEmptyString255(name),
    libraryProductId: NonEmptyString255(name.toLowerCase().replace(/ /g, "-")),
    unitAmount: NonNegativeInteger(unitAmount),
    categoryName:
      categoryName === null ? null : NonEmptyString255(categoryName),
    taxRatePercentage:
      taxRatePercentage === null ? null : TaxRatePercentage(taxRatePercentage),
  })

  const createRun = (evolu: EvoluDep["evolu"]) =>
    testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
    })

  test("creates the starter items with their categories and VAT rates", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = createRun(evolu)

    await run.orThrow(
      finishOnboarding({
        ...input,
        homeMode: "pos",
        starterItems: [
          starterItem({
            name: "Espresso",
            unitAmount: 5_900,
            categoryName: "Káva",
            taxRatePercentage: 1200,
          }),
          starterItem({
            name: "Točené pivo 0,5 l",
            unitAmount: 6_500,
            categoryName: "Pivo",
            taxRatePercentage: 2100,
          }),
          starterItem({
            name: "Cappuccino",
            unitAmount: 6_900,
            categoryName: "Káva",
            taxRatePercentage: 1200,
          }),
          starterItem({
            name: "Tonic",
            unitAmount: 4_500,
            categoryName: null,
            taxRatePercentage: 1500,
          }),
        ],
      })
    )

    await expect.poll(() => evolu.loadQuery(catalogItemsQuery)).toHaveLength(4)
    const [items, categories, taxRates] = await Promise.all([
      evolu.loadQuery(catalogItemsQuery),
      evolu.loadQuery(catalogCategoriesQuery),
      evolu.loadQuery(activeTaxRatesQuery),
    ])
    const categoryId = (name: string) =>
      categories.find((category) => category.name === name)?.id
    const taxRateId = (rate: number) =>
      taxRates.find((taxRate) => taxRate.rate === rate)?.id

    expect(categories.map(({ name }) => name)).toEqual(["Káva", "Pivo"])
    expect(items).toEqual([
      expect.objectContaining({
        name: "Espresso",
        libraryProductId: "espresso",
        currency: "CZK",
        categoryId: categoryId("Káva"),
        taxRateId: taxRateId(1200),
        sortOrder: 0,
      }),
      expect.objectContaining({
        name: "Točené pivo 0,5 l",
        categoryId: categoryId("Pivo"),
        taxRateId: taxRateId(2100),
        sortOrder: 1,
      }),
      expect.objectContaining({
        name: "Cappuccino",
        categoryId: categoryId("Káva"),
        taxRateId: taxRateId(1200),
        sortOrder: 2,
      }),
      // No category, and no Czech rate of 15 %.
      expect.objectContaining({
        name: "Tonic",
        categoryId: null,
        taxRateId: null,
        sortOrder: 3,
      }),
    ])
    expect(taxRateId(1200)).toBeDefined()
    expect(taxRateId(2100)).toBeDefined()
  }, 15_000)

  test("keeps the starter items' prices exactly as the merchant typed them", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = createRun(evolu)

    await run.orThrow(
      finishOnboarding({
        ...input,
        homeMode: "pos",
        starterItems: [
          starterItem({
            name: "Espresso",
            unitAmount: 5_950,
            categoryName: null,
            taxRatePercentage: null,
          }),
          starterItem({
            name: "Tap water",
            unitAmount: 0,
            categoryName: null,
            taxRatePercentage: null,
          }),
          starterItem({
            name: "Cheese board",
            unitAmount: 24_901,
            categoryName: null,
            taxRatePercentage: null,
          }),
        ],
      })
    )

    await expect
      .poll(async () =>
        (await evolu.loadQuery(catalogItemsQuery)).map(
          ({ name, unitAmount }) => [name, unitAmount]
        )
      )
      .toEqual([
        ["Espresso", 5_950],
        ["Tap water", 0],
        ["Cheese board", 24_901],
      ])
  }, 15_000)

  test("writes the starter categories and items in the batch that marks the account onboarded", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = createRun(evolu)
    const upsertSpy = vi.spyOn(evolu, "upsert")

    await run.orThrow(
      finishOnboarding({
        ...input,
        homeMode: "pos",
        starterItems: [
          starterItem({
            name: "Espresso",
            unitAmount: 5_900,
            categoryName: "Káva",
            taxRatePercentage: 1200,
          }),
          starterItem({
            name: "Točené pivo 0,5 l",
            unitAmount: 6_500,
            categoryName: "Pivo",
            taxRatePercentage: 2100,
          }),
        ],
      })
    )

    const lastBatch = upsertSpy.mock.calls.filter(([table]) =>
      ["catalogCategory", "catalogItem", "appSettings"].includes(table)
    )
    upsertSpy.mockRestore()
    // A finish cut short between them would leave a pack without the row
    // that keeps the wizard from creating it a second time.
    expect(lastBatch.map(([table]) => table).toSorted()).toEqual([
      "appSettings",
      "catalogCategory",
      "catalogCategory",
      "catalogItem",
      "catalogItem",
    ])
    expect(new Set(lastBatch.map((call) => call[2]?.onComplete)).size).toBe(1)
  }, 15_000)

  test("a refused starter pack leaves the account not onboarded and writes no categories or items", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = createRun(evolu)
    // A VAT payer, which a product given away without a VAT rate breaks
    // (catalog/0001): Czech VAT has no rate of 15 %.
    await run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))

    await expect(
      run(
        finishOnboarding({
          ...input,
          homeMode: "pos",
          starterItems: [
            starterItem({
              name: "Espresso",
              unitAmount: 5_900,
              categoryName: "Káva",
              taxRatePercentage: 1200,
            }),
            starterItem({
              name: "Tap water",
              unitAmount: 0,
              categoryName: "Nápoje",
              taxRatePercentage: 1500,
            }),
          ],
        })
      )
    ).resolves.toEqual({
      ok: false,
      error: { type: "ZeroPriceWithoutTaxRate" },
    })

    const [settings, items, categories] = await Promise.all([
      evolu.loadQuery(settingsQuery),
      evolu.loadQuery(catalogItemsQuery),
      evolu.loadQuery(catalogCategoriesQuery),
    ])
    expect([settings, items, categories]).toEqual([[], [], []])
  }, 15_000)

  test("finishing again after a refused pack creates each category and item once", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = createRun(evolu)
    await run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))
    const espresso = starterItem({
      name: "Espresso",
      unitAmount: 5_900,
      categoryName: "Káva",
      taxRatePercentage: 1200,
    })
    const tapWater = starterItem({
      name: "Tap water",
      unitAmount: 0,
      categoryName: "Nápoje",
      taxRatePercentage: 1500,
    })

    const refused = await run(
      finishOnboarding({
        ...input,
        homeMode: "pos",
        starterItems: [espresso, tapWater],
      })
    )
    expect(refused.ok).toBe(false)
    // The merchant prices the water and finishes again.
    await run.orThrow(
      finishOnboarding({
        ...input,
        homeMode: "pos",
        starterItems: [
          espresso,
          { ...tapWater, unitAmount: NonNegativeInteger(1_000) },
        ],
      })
    )

    await expect.poll(() => evolu.loadQuery(settingsQuery)).toHaveLength(1)
    const [items, categories] = await Promise.all([
      evolu.loadQuery(catalogItemsQuery),
      evolu.loadQuery(catalogCategoriesQuery),
    ])
    expect(categories.map(({ name }) => name)).toEqual(["Káva", "Nápoje"])
    expect(items.map(({ name, sortOrder }) => [name, sortOrder])).toEqual([
      ["Espresso", 0],
      ["Tap water", 1],
    ])
  }, 15_000)

  test("creates no catalog items without starter items", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = createRun(evolu)

    await run.orThrow(finishOnboarding({ ...input, homeMode: "pos" }))

    await expect.poll(() => evolu.loadQuery(settingsQuery)).toHaveLength(1)
    expect(await evolu.loadQuery(catalogItemsQuery)).toEqual([])
    expect(await evolu.loadQuery(catalogCategoriesQuery)).toEqual([])
  }, 15_000)
})
