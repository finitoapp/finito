import { sqliteTrue, testCreateConsole, testCreateRun } from "@evolu/common"
import { describe, expect, test, vi } from "vitest"
import { createQuery } from "../../evolu/schema.ts"
import { createAccount } from "../../modules/account/account-actions.ts"
import type { AccountId } from "../../modules/account/account-types.ts"
import { createAccountTransaction } from "../../modules/account-transaction/account-transaction-actions.ts"
import {
  addFioPluginToken,
  deleteFioPluginToken,
  saveFioPlugin,
} from "../../modules/fio-plugin/fio-plugin-actions.ts"
import type { FioPluginId } from "../../modules/fio-plugin/fio-plugin-types.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import {
  dateStringToDate,
  dateToDateString,
} from "../../modules/shared/date-string-utils.ts"
import {
  DateStringSchema,
  IbanSchema,
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  SpecificSymbol,
  VariableSymbol,
} from "../../modules/shared/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { testNotificationsDep } from "../../testing/background-jobs.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createFioAccountTransactionSyncJob } from "./fio-account-transaction-sync-job.ts"

const ibanTransactionsByAccountIdQuery = (accountId: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .innerJoin(
        "accountTransactionIban",
        "accountTransactionIban.id",
        "accountTransaction.id"
      )
      .select([
        "accountTransaction.accountId",
        "accountTransaction.amount",
        "accountTransaction.currency",
        "accountTransaction.occurredAt",
        "accountTransaction.note",
        "accountTransactionIban.variableSymbol",
        "accountTransactionIban.constantSymbol",
        "accountTransactionIban.specificSymbol",
        "accountTransactionIban.bankReference",
      ])
      .where("accountTransaction.accountId", "=", accountId)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
  )

const fioPluginSyncPointerQuery = (fioPluginId: FioPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("fioPluginSyncPointer")
      .select(["id", "lastSyncedDate"])
      .where("id", "=", fioPluginId)
      .where("isDeleted", "is", null)
  )

const reconciliationClaimsByAccountIdQuery = (accountId: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin(
        "accountTransaction",
        "accountTransaction.id",
        "reconciliationClaim.accountTransactionId"
      )
      .select(["reconciliationClaim.paymentId"])
      .where("accountTransaction.accountId", "=", accountId)
      .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
  )

const fioTransaction = {
  column0: { value: 123456789, name: "ID pohybu" },
  column1: { value: "2026-05-26+02:00", name: "Datum" },
  column2: { value: "199.50", name: "Objem" },
  column3: { value: "CZK", name: "Měna" },
  column4: { value: "2600123456", name: "Protiúčet" },
  column5: { value: "Customer Ltd.", name: "Název protiúčtu" },
  column6: { value: "2010", name: "Kód banky" },
  column7: { value: "Fio banka, a.s.", name: "Název banky" },
  column8: { value: "0308", name: "KS" },
  column9: { value: "123456", name: "VS" },
  column10: { value: "789", name: "SS" },
  column11: { value: "Terminal 1", name: "Uživatelská identifikace" },
  column12: { value: "Thanks", name: "Zpráva pro příjemce" },
  column13: { value: "Bezhotovostní příjem", name: "Typ" },
}

const statementResponse = ({
  iban = "CZ6508000000192000145399",
  transactions,
}: {
  readonly iban?: string
  readonly transactions: unknown
}) =>
  new Response(
    JSON.stringify({
      accountStatement: {
        info: {
          iban,
          currency: "CZK",
        },
        transactionList: {
          transaction: transactions,
        },
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

const inputToString = (input: RequestInfo | URL): string =>
  input instanceof URL ? input.toString() : String(input)

describe("fio account transaction sync job", () => {
  test("downloads FIO transactions into IBAN account transactions without duplicates", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    })
    const errors: unknown[] = []
    const requestedUrls: string[] = []
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        syncLookbackDays: PositiveInteger(1),
        isActive: sqliteTrue,
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(19_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId,
          variableSymbol: VariableSymbol("123456"),
          specificSymbol: SpecificSymbol("789"),
        },
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    const upsertSpy = vi.spyOn(evolu, "upsert")
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
      fetch: async (input: RequestInfo | URL) => {
        requestedUrls.push(inputToString(input))
        return statementResponse({
          transactions: [fioTransaction, fioTransaction],
        })
      },
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect
      .poll(() => evolu.loadQuery(ibanTransactionsByAccountIdQuery(accountId)))
      .toEqual([
        {
          accountId,
          amount: 19950,
          currency: "CZK",
          occurredAt: dateStringToDate(
            DateStringSchema.decode("2026-05-26")
          ).getTime(),
          note: "Customer Ltd. | Thanks | Terminal 1 | Bezhotovostní příjem",
          variableSymbol: "123456",
          constantSymbol: "0308",
          specificSymbol: "789",
          bankReference: "123456789",
        },
      ])

    expect(requestedUrls).toEqual([
      "https://fioapi.fio.cz/v1/rest/periods/fio-token-1/2026-03-31/2026-05-31/transactions.json",
    ])
    await expect
      .poll(() => evolu.loadQuery(fioPluginSyncPointerQuery(fioPluginId)))
      .toEqual([
        {
          id: fioPluginId,
          lastSyncedDate: "2026-05-31",
        },
      ])
    await expect
      .poll(() =>
        evolu.loadQuery(reconciliationClaimsByAccountIdQuery(accountId))
      )
      .toEqual([{ paymentId }])
    const writeCalls = upsertSpy.mock.calls.filter(
      (call) =>
        call[0] === "accountTransaction" || call[0] === "reconciliationClaim"
    )
    const completions = new Set(writeCalls.map((call) => call[2]?.onComplete))
    upsertSpy.mockRestore()
    expect(writeCalls).toHaveLength(2)
    expect(completions.size).toBe(1)
    expect(errors).toEqual([])
  })

  test("a second FIO transfer quoting a paid payment's symbols claims it as overpaid", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    })
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        syncLookbackDays: PositiveInteger(1),
        isActive: sqliteTrue,
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(19_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId,
          variableSymbol: VariableSymbol("123456"),
          specificSymbol: SpecificSymbol("789"),
        },
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: () => undefined,
      fetch: async () =>
        statementResponse({
          transactions: [
            fioTransaction,
            {
              ...fioTransaction,
              column0: { value: 987654321, name: "ID pohybu" },
            },
          ],
        }),
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect
      .poll(() =>
        evolu.loadQuery(reconciliationClaimsByAccountIdQuery(accountId))
      )
      .toEqual([{ paymentId }, { paymentId }])
  })

  test("retries reconciliation for a bank reference already recorded but never claimed", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    })
    const errors: unknown[] = []
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(19_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId,
          variableSymbol: VariableSymbol("123456"),
          specificSymbol: SpecificSymbol("789"),
        },
      })
    )
    // Simulates a prior sync that recorded the transaction but crashed (or
    // threw) before it got a chance to reconcile it — the FIO API is never
    // asked about a statement line it already has by bank reference, so
    // without a retry this claim would never be attempted again.
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(19_950),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        iban: {
          variableSymbol: VariableSymbol("123456"),
          constantSymbol: null,
          specificSymbol: SpecificSymbol("789"),
          bankReference: NonEmptyString255("123456789"),
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        syncLookbackDays: PositiveInteger(1),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
      fetch: async () =>
        statementResponse({
          transactions: [fioTransaction],
        }),
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect
      .poll(() =>
        evolu.loadQuery(reconciliationClaimsByAccountIdQuery(accountId))
      )
      .toEqual([{ paymentId }])

    // Still exactly one account transaction — the retry reconciled the
    // existing row rather than recording a duplicate.
    expect(
      await evolu.loadQuery(ibanTransactionsByAccountIdQuery(accountId))
    ).toEqual([
      {
        accountId,
        amount: 19950,
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
        note: null,
        variableSymbol: "123456",
        constantSymbol: null,
        specificSymbol: "789",
        bankReference: "123456789",
      },
    ])
    expect(accountTransactionId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test("uses local sync pointer and configured lookback for the next period", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const requestedUrls: string[] = []
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        syncLookbackDays: PositiveInteger(3),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    evolu.upsert(
      "fioPluginSyncPointer",
      {
        id: fioPluginId,
        lastSyncedDate: DateStringSchema.decode("2026-05-20"),
      },
      { owner: evolu.appOwner }
    )
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
      fetch: async (input: RequestInfo | URL) => {
        requestedUrls.push(inputToString(input))
        return statementResponse({
          transactions: [fioTransaction],
        })
      },
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect
      .poll(() => evolu.loadQuery(ibanTransactionsByAccountIdQuery(accountId)))
      .toHaveLength(1)

    expect(requestedUrls).toEqual([
      "https://fioapi.fio.cz/v1/rest/periods/fio-token-1/2026-05-17/2026-05-31/transactions.json",
    ])
    // Polled, like the same assertion earlier in this file: the job advances
    // the sync pointer in a mutation of its own, so waiting for the imported
    // transaction says nothing about the pointer having landed yet.
    await expect
      .poll(() => evolu.loadQuery(fioPluginSyncPointerQuery(fioPluginId)))
      .toEqual([
        {
          id: fioPluginId,
          lastSyncedDate: "2026-05-31",
        },
      ])
    expect(errors).toEqual([])
  })

  test("does not advance the sync pointer when a transaction lock is held", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const console = testCreateConsole()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        syncLookbackDays: PositiveInteger(1),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    evolu.upsert(
      "fioPluginSyncPointer",
      {
        id: fioPluginId,
        lastSyncedDate: DateStringSchema.decode("2026-05-20"),
      },
      { owner: evolu.appOwner }
    )
    const lockManager = createInProcessLockManager()
    const lockAcquired = Promise.withResolvers<void>()
    const releaseLock = Promise.withResolvers<void>()
    const heldLock = lockManager.request(
      `fio-transaction-${accountId}-${fioTransaction.column0.value}`,
      async () => {
        lockAcquired.resolve()
        await releaseLock.promise
      }
    )
    await lockAcquired.promise

    try {
      await using jobRun = testCreateRun({
        console,
        ...evoluTestDeps(evolu),
        lockManager,
        ...testNotificationsDep(),
        onError: (error: unknown) => {
          errors.push(error)
        },
        fetch: async () =>
          statementResponse({ transactions: [fioTransaction] }),
        ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
      })
      await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

      await expect
        .poll(() => console.getEntriesSnapshot())
        .toContainEqual({
          method: "debug",
          path: ["fio-account-transaction-sync-job"],
          args: [
            "Did not advance FIO sync pointer because a transaction was locked.",
            { accountId, pluginId: fioPluginId },
          ],
        })
      expect(
        await evolu.loadQuery(fioPluginSyncPointerQuery(fioPluginId))
      ).toEqual([{ id: fioPluginId, lastSyncedDate: "2026-05-20" }])
      expect(errors).toEqual([])
    } finally {
      releaseLock.resolve()
      await heldLock
    }
  })

  test("logs FIO rate limiting without reporting a job error", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const console = testCreateConsole()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    await using jobRun = testCreateRun({
      console,
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
      fetch: async () =>
        new Response("Interval between requests was not respected.", {
          status: 409,
        }),
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect
      .poll(() => console.getEntriesSnapshot())
      .toContainEqual({
        method: "error",
        path: ["fio-account-transaction-sync-job"],
        args: [
          "Skipped FIO sync because of rate limiting.",
          {
            accountId,
            pluginId: fioPluginId,
            responseBody: "Interval between requests was not respected.",
          },
        ],
      })
    expect(errors).toEqual([])
  })

  test("rotates FIO tokens between sync cycles", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const requestedUrls: string[] = []
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(1),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-2"),
      })
    )
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
      fetch: async (input: RequestInfo | URL) => {
        requestedUrls.push(inputToString(input))
        return statementResponse({
          transactions: [],
        })
      },
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect
      .poll(() => requestedUrls.length, { timeout: 3_000 })
      .toBeGreaterThanOrEqual(2)

    expect(requestedUrls.slice(0, 2)).toEqual([
      "https://fioapi.fio.cz/v1/rest/periods/fio-token-1/2026-03-31/2026-05-31/transactions.json",
      "https://fioapi.fio.cz/v1/rest/periods/fio-token-2/2026-05-30/2026-05-31/transactions.json",
    ])
    expect(errors).toEqual([])
  })

  test("switches to a replacement token set without restarting the job", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const requestedUrls: string[] = []
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(1),
        isActive: sqliteTrue,
      })
    )
    const staleTokenId = await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-stale"),
      })
    )
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
      fetch: async (input: RequestInfo | URL) => {
        requestedUrls.push(inputToString(input))
        return statementResponse({ transactions: [] })
      },
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect
      .poll(() => requestedUrls.length, { timeout: 3_000 })
      .toBeGreaterThanOrEqual(1)
    expect(requestedUrls[0]).toContain("fio-token-stale")

    // The token is rotated the way the settings UI does it: add the new one,
    // remove the old. The job subscribes to `activeFioPluginsQuery` and
    // `FioPluginSync.matches` compares the token set, so its session — and
    // with it the `createFioApiDep` rotation — must be rebuilt around the
    // replacement. Before tokens were managed separately, the old one stayed
    // in the set and the job kept retrying a revoked token forever.
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-fresh"),
      })
    )
    await run.ok(deleteFioPluginToken(staleTokenId))

    const staleRequestsAtRotation = requestedUrls.filter((url) =>
      url.includes("fio-token-stale")
    ).length

    await expect
      .poll(
        () => requestedUrls.some((url) => url.includes("fio-token-fresh")),
        {
          timeout: 5_000,
        }
      )
      .toBe(true)

    // And nothing went back to the revoked token after it was removed.
    expect(
      requestedUrls.filter((url) => url.includes("fio-token-stale")).length
    ).toBe(staleRequestsAtRotation)
    expect(errors).toEqual([])
  }, 20_000)

  test("skips statements for a different IBAN", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const fioPluginId = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
      fetch: async () =>
        statementResponse({
          iban: "CZ5508000000001234567899",
          transactions: [fioTransaction],
        }),
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(
      await evolu.loadQuery(ibanTransactionsByAccountIdQuery(accountId))
    ).toEqual([])
    expect(errors).toEqual([])
  })
})

describe("FIO sync date helpers", () => {
  // Both formatting and parsing read the local clock, so under TZ=UTC the old
  // UTC-parsing version is indistinguishable from the fix. A negative offset is
  // the only place the drift shows.
  test("round-trip a date string unchanged west of UTC", () => {
    const originalTimeZone = process.env.TZ

    try {
      process.env.TZ = "America/New_York"

      const stored = DateStringSchema.decode("2026-05-20")

      expect(dateToDateString(dateStringToDate(stored))).toBe(stored)
    } finally {
      process.env.TZ = originalTimeZone
    }
  })
})
