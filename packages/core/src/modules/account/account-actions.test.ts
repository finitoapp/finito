import {
  evoluJsonObjectFrom,
  sqliteFalse,
  sqliteTrue,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { EvoluOwnerDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createTestDateDep, testFixedDate } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { saveFioPlugin } from "../fio-plugin/fio-plugin-actions.ts"
import { fioPluginByIdQuery } from "../fio-plugin/fio-plugin-queries.ts"
import { fioPluginId } from "../fio-plugin/fio-plugin-utils.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  deriveDefaultSparkWalletSecret,
  MasterKey,
  SparkSecret,
  sparkSecretToMnemonic,
} from "../shared/key-derivation.ts"
import {
  IbanSchema,
  NonEmptyString255,
  PositiveInteger,
  TimestampMs,
} from "../shared/schema.ts"
import {
  createAccount,
  deleteAccount,
  loadAccount,
  saveCashRegisterAccount,
  saveFiatBankAccount,
  saveLightningAddressAccount,
  saveSparkAccount,
  selectCustomSparkWallet,
  selectDefaultSparkWallet,
  updateAccount,
  updateSparkAccountSyncPointer,
} from "./account-actions.ts"
import {
  accountByIdQuery,
  cashRegisterAccountQuery,
  fiatBankAccountQuery,
  lightningAddressAccountQuery,
  sparkAccountQuery,
} from "./account-queries.ts"
import type { AccountId } from "./account-types.ts"
import {
  createCashRegisterAccountId,
  createIbanAccountId,
  createLightningAddressAccountId,
  createSparkAccountId,
  legacyFiatBankAccountId,
} from "./account-utils.ts"

const accountWithDetailsByIdQuery = (id: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .select((eb) => [
        "account.id",
        "account.deviceId",
        "account.name",
        "account.kind",
        "account.isDeleted",
        evoluJsonObjectFrom(
          eb
            .selectFrom("accountIban")
            .select([
              "accountIban.id",
              "accountIban.iban",
              "accountIban.currency",
              "accountIban.isDeleted",
            ])
            .whereRef("accountIban.id", "=", "account.id")
        ).as("iban"),
        evoluJsonObjectFrom(
          eb
            .selectFrom("accountSpark")
            .select([
              "accountSpark.id",
              "accountSpark.secret",
              "accountSpark.isDeleted",
            ])
            .whereRef("accountSpark.id", "=", "account.id")
        ).as("spark"),
        evoluJsonObjectFrom(
          eb
            .selectFrom("accountCashRegister")
            .select([
              "accountCashRegister.id",
              "accountCashRegister.currency",
              "accountCashRegister.isDeleted",
            ])
            .whereRef("accountCashRegister.id", "=", "account.id")
        ).as("cashRegister"),
      ])
      .where("account.id", "=", id)
  )

const sparkAccountSyncPointerByIdQuery = (id: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("sparkAccountSyncPointer")
      .select(["id", "lastSyncedAt", "isDeleted"])
      .where("id", "=", id)
  )

describe("account actions", () => {
  test("creates and loads account variants through real Evolu", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const ibanAccountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const sparkAccountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark wallet"),
        spark: {
          secret: SparkSecret("42373a7543db65ae0228ead6c9cbffcc"),
        },
      })
    )
    const cashRegisterAccountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: {
          currency: "CZK",
        },
      })
    )

    expect(ibanAccountId).toBe(
      createIbanAccountId({
        iban: IbanSchema.decode("CZ6508000000192000145399"),
        currency: "CZK",
      })
    )
    expect(sparkAccountId).toBe(
      createSparkAccountId(SparkSecret("42373a7543db65ae0228ead6c9cbffcc"))
    )
    expect(cashRegisterAccountId).toBe(createCashRegisterAccountId("CZK"))

    await expect
      .poll(() => evolu.loadQuery(accountWithDetailsByIdQuery(ibanAccountId)))
      .toMatchObject([
        {
          id: ibanAccountId,
          deviceId: null,
          name: "Bank account",
          kind: "iban",
          iban: {
            id: ibanAccountId,
            iban: "CZ6508000000192000145399",
            currency: "CZK",
          },
          spark: null,
          cashRegister: null,
        },
      ])

    await expect
      .poll(() => evolu.loadQuery(accountWithDetailsByIdQuery(sparkAccountId)))
      .toMatchObject([
        {
          id: sparkAccountId,
          deviceId: null,
          name: "Spark wallet",
          kind: "spark",
          iban: null,
          spark: {
            id: sparkAccountId,
            secret: "42373a7543db65ae0228ead6c9cbffcc",
          },
          cashRegister: null,
        },
      ])

    await expect
      .poll(() => evolu.loadQuery(accountByIdQuery(cashRegisterAccountId)))
      .toMatchObject([
        {
          id: cashRegisterAccountId,
          deviceId: null,
          name: "Cash register",
          kind: "cashRegister",
        },
      ])
    await expect
      .poll(() =>
        evolu.loadQuery(accountWithDetailsByIdQuery(cashRegisterAccountId))
      )
      .toMatchObject([
        {
          id: cashRegisterAccountId,
          deviceId: null,
          name: "Cash register",
          kind: "cashRegister",
          iban: null,
          spark: null,
          cashRegister: {
            id: cashRegisterAccountId,
            currency: "CZK",
          },
        },
      ])

    await expect(run(loadAccount(ibanAccountId))).resolves.toMatchObject({
      ok: true,
      value: {
        id: ibanAccountId,
        name: "Bank account",
        kind: "iban",
      },
    })
  }, 15_000)

  test("updates account details without writing undefined values", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )

    await expect
      .poll(() => evolu.loadQuery(accountByIdQuery(id)))
      .toHaveLength(1)

    await expect(
      run(
        updateAccount({
          id,
          deviceId: undefined,
          name: NonEmptyString255("Updated bank account"),
          iban: { defaultQrFormat: undefined },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    // The IBAN and currency the id derives from stay as they were.
    await expect
      .poll(() => evolu.loadQuery(accountWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          deviceId: null,
          name: "Updated bank account",
          kind: "iban",
          iban: {
            id,
            iban: "CZ6508000000192000145399",
            currency: "CZK",
          },
        },
      ])
  }, 15_000)

  test("soft deletes only the account root row", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: {
          currency: "CZK",
        },
      })
    )

    await expect
      .poll(() => evolu.loadQuery(accountByIdQuery(id)))
      .toHaveLength(1)

    await expect(run(deleteAccount(id))).resolves.toEqual({
      ok: true,
      value: id,
    })

    await expect
      .poll(() => evolu.loadQuery(accountWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          isDeleted: sqliteTrue,
          cashRegister: {
            currency: "CZK",
            isDeleted: null,
          },
        },
      ])
    await expect(run(loadAccount(id))).resolves.toMatchObject({
      ok: true,
      value: {
        id,
        isDeleted: sqliteTrue,
      },
    })
  }, 15_000)

  test("saves the fiat bank account at its derived id and replaces it when the IBAN or currency changes", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const firstIban = IbanSchema.decode("CZ6508000000192000145399")
    const secondIban = IbanSchema.decode("CZ5508000000001234567899")
    const firstId = createIbanAccountId({ iban: firstIban, currency: "CZK" })
    const secondId = createIbanAccountId({ iban: secondIban, currency: "EUR" })
    const thirdId = createIbanAccountId({ iban: secondIban, currency: "CZK" })

    await expect(
      run(saveFiatBankAccount({ enabled: false, currency: "CZK" }))
    ).resolves.toEqual({ ok: true, value: null })

    await expect(
      run(
        saveFiatBankAccount({
          enabled: true,
          iban: firstIban,
          currency: "CZK",
        })
      )
    ).resolves.toEqual({ ok: true, value: firstId })

    await expect
      .poll(() => evolu.loadQuery(fiatBankAccountQuery))
      .toMatchObject([
        {
          id: firstId,
          name: "Fiat bank account",
          kind: "iban",
          isDeleted: sqliteFalse,
          iban: firstIban,
          currency: "CZK",
        },
      ])

    await expect(
      run(
        saveFiatBankAccount({
          enabled: false,
          iban: secondIban,
          currency: "EUR",
        })
      )
    ).resolves.toEqual({ ok: true, value: secondId })

    await expect
      .poll(() => evolu.loadQuery(fiatBankAccountQuery))
      .toMatchObject([
        {
          id: secondId,
          isDeleted: sqliteTrue,
          iban: secondIban,
          currency: "EUR",
        },
      ])
    await expect
      .poll(() => evolu.loadQuery(accountByIdQuery(firstId)))
      .toMatchObject([{ isDeleted: sqliteTrue }])

    // Without an IBAN the current one is kept; the currency still applies.
    await expect(
      run(saveFiatBankAccount({ enabled: true, currency: "CZK" }))
    ).resolves.toEqual({ ok: true, value: thirdId })

    await expect
      .poll(() => evolu.loadQuery(fiatBankAccountQuery))
      .toMatchObject([
        {
          id: thirdId,
          isDeleted: sqliteFalse,
          iban: secondIban,
          currency: "CZK",
        },
      ])
  }, 15_000)

  test("re-points the Fio plugin at the fiat bank account it saves", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const iban = IbanSchema.decode("CZ6508000000192000145399")

    // Saved before any bank account existed, so on the placeholder id.
    await run.ok(
      saveFioPlugin({
        accountId: legacyFiatBankAccountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        isActive: sqliteTrue,
      })
    )

    const firstId = await run.ok(
      saveFiatBankAccount({ enabled: true, iban, currency: "CZK" })
    )
    await expect
      .poll(() => evolu.loadQuery(fioPluginByIdQuery(fioPluginId)))
      .toMatchObject([{ accountId: firstId }])

    const secondId = await run.ok(
      saveFiatBankAccount({ enabled: true, iban, currency: "EUR" })
    )
    expect(secondId).not.toBe(firstId)
    await expect
      .poll(() => evolu.loadQuery(fioPluginByIdQuery(fioPluginId)))
      .toMatchObject([
        { accountId: secondId, numberOfSecondsBetweenChecks: 60 },
      ])
  }, 15_000)

  test("moves the cash register to its currency's account", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    await expect(
      run(saveCashRegisterAccount({ enabled: false, currency: "CZK" }))
    ).resolves.toEqual({ ok: true, value: null })
    await run.ok(saveCashRegisterAccount({ enabled: true, currency: "CZK" }))
    await expect(
      run(saveCashRegisterAccount({ enabled: true, currency: "EUR" }))
    ).resolves.toEqual({ ok: true, value: createCashRegisterAccountId("EUR") })

    await expect
      .poll(() => evolu.loadQuery(cashRegisterAccountQuery))
      .toMatchObject([
        {
          id: createCashRegisterAccountId("EUR"),
          isDeleted: sqliteFalse,
          currency: "EUR",
        },
      ])
    await expect
      .poll(() =>
        evolu.loadQuery(accountByIdQuery(createCashRegisterAccountId("CZK")))
      )
      .toMatchObject([{ isDeleted: sqliteTrue }])

    // Back to an account used before: re-saving it makes it the latest save, so
    // it is still the one picked once disabled, not the EUR one in between.
    await run.ok(saveCashRegisterAccount({ enabled: true, currency: "CZK" }))
    await expect(
      run(saveCashRegisterAccount({ enabled: false, currency: "CZK" }))
    ).resolves.toEqual({ ok: true, value: createCashRegisterAccountId("CZK") })
    await expect
      .poll(() => evolu.loadQuery(cashRegisterAccountQuery))
      .toMatchObject([
        { id: createCashRegisterAccountId("CZK"), isDeleted: sqliteTrue },
      ])
  }, 15_000)

  test("saves a new account when the Lightning address changes and keeps the old one for its history", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const alby = NonEmptyString255("shop@getalby.com")
    const blink = NonEmptyString255("shop@blink.sv")

    await expect(
      run(saveLightningAddressAccount({ enabled: true }))
    ).resolves.toEqual({ ok: true, value: null })
    await expect(
      run(saveLightningAddressAccount({ enabled: true, address: alby }))
    ).resolves.toEqual({
      ok: true,
      value: createLightningAddressAccountId(alby),
    })
    await expect(
      run(saveLightningAddressAccount({ enabled: true, address: blink }))
    ).resolves.toEqual({
      ok: true,
      value: createLightningAddressAccountId(blink),
    })

    await expect
      .poll(() => evolu.loadQuery(lightningAddressAccountQuery))
      .toMatchObject([
        {
          id: createLightningAddressAccountId(blink),
          isDeleted: sqliteFalse,
          name: blink,
          kind: "lightningAddress",
          address: blink,
        },
      ])
    await expect
      .poll(() =>
        evolu.loadQuery(accountByIdQuery(createLightningAddressAccountId(alby)))
      )
      .toMatchObject([{ isDeleted: sqliteTrue, name: alby }])

    // The switch on the overview disables the address it already has.
    await run.ok(saveLightningAddressAccount({ enabled: false }))
    await expect
      .poll(() => evolu.loadQuery(lightningAddressAccountQuery))
      .toMatchObject([
        { id: createLightningAddressAccountId(blink), isDeleted: sqliteTrue },
      ])
  }, 15_000)

  test("derives the default Spark wallet secret from the master key", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const masterKey = MasterKey("000102030405060708090a0b0c0d0e0f")
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey,
    })

    const secret = deriveDefaultSparkWalletSecret(masterKey)

    await expect(run(saveSparkAccount({ enabled: true }))).resolves.toEqual({
      ok: true,
      value: createSparkAccountId(secret),
    })

    await expect
      .poll(() => evolu.loadQuery(sparkAccountQuery))
      .toMatchObject([
        { id: createSparkAccountId(secret), isDeleted: sqliteFalse, secret },
      ])
  })

  test("keeps the Spark wallet already configured", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const masterKey = MasterKey("000102030405060708090a0b0c0d0e0f")
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey,
    })

    const attachedSecret = SparkSecret("7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f")
    const attachedId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: { secret: attachedSecret },
      })
    )
    await run.ok(deleteAccount(attachedId))

    await expect(run(saveSparkAccount({ enabled: true }))).resolves.toEqual({
      ok: true,
      value: attachedId,
    })

    await expect
      .poll(() => evolu.loadQuery(sparkAccountQuery))
      .toMatchObject([{ isDeleted: sqliteFalse, secret: attachedSecret }])
  })

  test("updates, clears, and restores the Spark account sync pointer", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const sparkAccountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: { secret: SparkSecret("42373a7543db65ae0228ead6c9cbffcc") },
      })
    )

    await run.ok(
      updateSparkAccountSyncPointer({
        id: sparkAccountId,
        lastSyncedAt: TimestampMs(Date.parse("2026-05-31T00:00:00.000Z")),
      })
    )
    await expect
      .poll(() =>
        evolu.loadQuery(sparkAccountSyncPointerByIdQuery(sparkAccountId))
      )
      .toEqual([
        {
          id: sparkAccountId,
          lastSyncedAt: Date.parse("2026-05-31T00:00:00.000Z"),
          isDeleted: sqliteFalse,
        },
      ])

    await run.ok(
      updateSparkAccountSyncPointer({ id: sparkAccountId, lastSyncedAt: null })
    )
    await expect
      .poll(() =>
        evolu.loadQuery(sparkAccountSyncPointerByIdQuery(sparkAccountId))
      )
      .toEqual([
        {
          id: sparkAccountId,
          lastSyncedAt: Date.parse("2026-05-31T00:00:00.000Z"),
          isDeleted: sqliteTrue,
        },
      ])

    await run.ok(
      updateSparkAccountSyncPointer({
        id: sparkAccountId,
        lastSyncedAt: TimestampMs(Date.parse("2026-06-01T00:00:00.000Z")),
      })
    )
    await expect
      .poll(() =>
        evolu.loadQuery(sparkAccountSyncPointerByIdQuery(sparkAccountId))
      )
      .toEqual([
        {
          id: sparkAccountId,
          lastSyncedAt: Date.parse("2026-06-01T00:00:00.000Z"),
          isDeleted: sqliteFalse,
        },
      ])
  })
  test("switches Spark payments to a custom wallet and back to the default", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const masterKey = MasterKey("000102030405060708090a0b0c0d0e0f")
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      masterKey,
      ...createTestDateDep(),
    })
    const defaultId = createSparkAccountId(
      deriveDefaultSparkWalletSecret(masterKey)
    )
    const customSecret = SparkSecret("7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f")
    const customId = createSparkAccountId(customSecret)

    await run.ok(saveSparkAccount({ enabled: true }))
    await run.ok(
      updateSparkAccountSyncPointer({
        id: defaultId,
        lastSyncedAt: TimestampMs(Date.parse("2026-09-01T00:00:00.000Z")),
      })
    )

    await expect(
      run(
        selectCustomSparkWallet({
          mnemonic: sparkSecretToMnemonic(customSecret),
        })
      )
    ).resolves.toEqual({ ok: true, value: customId })

    await expect
      .poll(() => evolu.loadQuery(sparkAccountQuery))
      .toMatchObject([
        { id: customId, isDeleted: sqliteFalse, secret: customSecret },
      ])
    await expect
      .poll(() => evolu.loadQuery(accountByIdQuery(defaultId)))
      .toMatchObject([{ isDeleted: sqliteTrue }])
    // A wallet new to Payky starts syncing from the switch, not from its
    // whole history.
    await expect
      .poll(() => evolu.loadQuery(sparkAccountSyncPointerByIdQuery(customId)))
      .toMatchObject([{ lastSyncedAt: testFixedDate.getTime() }])

    await expect(run(selectDefaultSparkWallet())).resolves.toEqual({
      ok: true,
      value: defaultId,
    })

    await expect
      .poll(() => evolu.loadQuery(sparkAccountQuery))
      .toMatchObject([{ id: defaultId, isDeleted: sqliteFalse }])
    await expect
      .poll(() => evolu.loadQuery(accountByIdQuery(customId)))
      .toMatchObject([{ isDeleted: sqliteTrue }])
    // The revived account picks its sync up where it left off.
    await expect
      .poll(() => evolu.loadQuery(sparkAccountSyncPointerByIdQuery(defaultId)))
      .toMatchObject([{ lastSyncedAt: Date.parse("2026-09-01T00:00:00.000Z") }])
  }, 15_000)
})
