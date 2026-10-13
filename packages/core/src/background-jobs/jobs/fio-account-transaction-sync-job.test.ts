import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  type SqliteBoolean,
  sqliteFalse,
  sqliteTrue,
  type TestConsole,
  testCreateConsole,
  testCreateRun,
} from "@evolu/common"
import { afterEach, describe, expect, onTestFinished, test, vi } from "vitest"

import { createQuery } from "../../evolu/schema.ts"
import { createAccount } from "../../modules/account/account-actions.ts"
import type { AccountId } from "../../modules/account/account-types.ts"
import { createAccountTransaction } from "../../modules/account-transaction/account-transaction-actions.ts"
import { loadBillStatus } from "../../modules/bill/bill-guards.ts"
import type { BillId } from "../../modules/bill/bill-types.ts"
import type { DeviceId } from "../../modules/device/device-types.ts"
import {
  addFioPluginToken,
  deleteFioPlugin,
  deleteFioPluginToken,
  saveFioPlugin,
} from "../../modules/fio-plugin/fio-plugin-actions.ts"
import {
  fioPluginSyncLeaseByPluginIdQuery,
  fioPluginTokensByPluginIdQuery,
  fioSyncDeviceUptimeByDeviceIdQuery,
} from "../../modules/fio-plugin/fio-plugin-queries.ts"
import type { FioPluginId } from "../../modules/fio-plugin/fio-plugin-types.ts"
import { fioSyncDeviceUptimeId } from "../../modules/fio-plugin/fio-plugin-utils.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import {
  dateStringToDate,
  dateToDateString,
} from "../../modules/shared/date-string-utils.ts"
import type { EvoluDep } from "../../modules/shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../../modules/shared/evolu-utils.ts"
import {
  DateStringSchema,
  IbanSchema,
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  SpecificSymbol,
  TimestampMs,
  VariableSymbol,
} from "../../modules/shared/schema.ts"
import { formatSelfPayBankMessage } from "../../modules/table-self-pay/table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  openSelfPayBill,
  type SelfPayTestContext,
  selectSelfPayTestShare,
  selfPayPointersByBillIdQuery,
} from "../../modules/table-self-pay/table-self-pay-test-fixtures.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createNodeEvolu } from "../../runtime/node-evolu.ts"
import { testNotificationsDep } from "../../testing/background-jobs.ts"
import { createTestDateDep, type TestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import {
  createFioAccountTransactionSyncJob,
  decideFioSyncLease,
  fioSyncUptimeAfterOff,
  fioSyncUptimeAfterRunning,
  getFioCheckIntervalMs,
} from "./fio-account-transaction-sync-job.ts"

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
        "accountTransactionIban.recipientMessage",
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

const selfPayStatementLine = ({
  id,
  reference,
  amount,
  message = null,
}: {
  readonly id: number
  readonly reference: string
  readonly amount: number
  readonly message?: string | null
}) => ({
  ...fioTransaction,
  column0: { value: id, name: "ID pohybu" },
  column1: { value: "2026-06-05+02:00", name: "Datum" },
  column2: { value: amount, name: "Objem" },
  column8: null,
  column9: { value: reference, name: "VS" },
  column10: null,
  column12:
    message === null ? null : { value: message, name: "Zpráva pro příjemce" },
})

const activateSelfPayFioPlugin = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  const fioPluginId = await run.ok(
    saveFioPlugin({
      accountId: context.ibanAccountId,
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
  return fioPluginId
}

const startSelfPayFioSync = async (
  context: SelfPayTestContext,
  transactions: ReadonlyArray<ReturnType<typeof selfPayStatementLine>>,
  errors: unknown[]
): Promise<AsyncDisposable> => {
  const jobRun = testCreateRun({
    ...context.deps,
    deviceId: context.deviceId,
    onError: (error: unknown) => {
      errors.push(error)
    },
    fetch: async () => statementResponse({ transactions }),
  })
  const job = await jobRun.ok(createFioAccountTransactionSyncJob())
  return {
    [Symbol.asyncDispose]: async () => {
      await job[Symbol.asyncDispose]()
      await jobRun[Symbol.asyncDispose]()
    },
  }
}

const billStatusOf = async (context: SelfPayTestContext, billId: BillId) => {
  await using run = testCreateRun(context.deps)
  return await run.orThrow(loadBillStatus(billId))
}

const fioTestStart = new Date("2026-05-31T10:00:00.000Z")

const secondsSinceFioTestStart = (clock: TestDateDep) =>
  (clock.date.now().getTime() - fioTestStart.getTime()) / 1000

const activateFioPlugin = async (
  evolu: EvoluDep["evolu"],
  {
    secondsPerToken,
    tokens,
  }: {
    readonly secondsPerToken: number
    readonly tokens: ReadonlyArray<string>
  }
) => {
  await using run = testCreateRun(evoluTestDeps(evolu))
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
      numberOfSecondsBetweenChecks: PositiveInteger(secondsPerToken),
      isActive: sqliteTrue,
    })
  )
  for (const token of tokens) {
    await run.ok(
      addFioPluginToken({ fioPluginId, token: NonEmptyString255(token) })
    )
  }
  return fioPluginId
}

const createSharedFio = (clock: TestDateDep) => {
  const lastAnsweredAtByToken = new Map<string, number>()
  const requests: string[] = []
  const as =
    (device: string) =>
    async (input: RequestInfo | URL): Promise<Response> => {
      const token = inputToString(input).split("/")[6] ?? ""
      const now = clock.date.now().getTime()
      const lastAnsweredAt = lastAnsweredAtByToken.get(token)
      const second = secondsSinceFioTestStart(clock)
      if (lastAnsweredAt !== undefined && now - lastAnsweredAt < 30_000) {
        requests.push(`${device} ${second} s 409`)
        return new Response("Interval between requests was not respected.", {
          status: 409,
        })
      }
      lastAnsweredAtByToken.set(token, now)
      requests.push(`${device} ${second} s 200`)
      return statementResponse({ transactions: [] })
    }
  return { requests, as }
}

const createRefusingFio = (clock: TestDateDep) => {
  const requestedAtSeconds: number[] = []
  const fetch = async (): Promise<Response> => {
    requestedAtSeconds.push(secondsSinceFioTestStart(clock))
    return new Response("Interval between requests was not respected.", {
      status: 409,
    })
  }
  return { requestedAtSeconds, fetch }
}

const createFioDeviceRun = ({
  evolu,
  clock,
  fetch,
  deviceId = createRowId<"Device">(),
  console = testCreateConsole(),
}: {
  readonly evolu: EvoluDep["evolu"]
  readonly clock: TestDateDep
  readonly fetch: (input: RequestInfo | URL) => Promise<Response>
  readonly deviceId?: DeviceId
  readonly console?: TestConsole
}) =>
  testCreateRun({
    console,
    ...evoluTestDeps(evolu),
    lockManager: createInProcessLockManager(),
    ...testNotificationsDep(),
    deviceId,
    onError: () => undefined,
    fetch,
    date: clock.date,
  })

const loggedMessages = (console: TestConsole) =>
  console.getEntriesSnapshot().map(({ args }) => args[0])

const advanceFioClock = async (clock: TestDateDep, milliseconds: number) => {
  clock.advance(milliseconds)
  await vi.advanceTimersByTimeAsync(milliseconds)
}

const saveFioSyncUptime = (
  evolu: EvoluDep["evolu"],
  {
    deviceId,
    uptimePerMille,
    measuredAt,
  }: {
    readonly deviceId: DeviceId
    readonly uptimePerMille: number
    readonly measuredAt: number
  }
) =>
  runMutationWithCompletion((options) =>
    evolu.upsert(
      "fioSyncDeviceUptime",
      {
        id: fioSyncDeviceUptimeId(deviceId),
        uptimePerMille: NonNegativeInteger(uptimePerMille),
        measuredAt: TimestampMs(measuredAt),
      },
      { ...options, owner: evolu.appOwner }
    )
  )

describe("fio account transaction sync job", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

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
      deviceId: createRowId<"Device">(),
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
          recipientMessage: "Thanks",
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
      deviceId: createRowId<"Device">(),
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
      deviceId: createRowId<"Device">(),
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
        recipientMessage: null,
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
      deviceId: createRowId<"Device">(),
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
        deviceId: createRowId<"Device">(),
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
      deviceId: createRowId<"Device">(),
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

  test("backs off after a 409 instead of asking FIO at every check", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1"],
    })
    const clock = createTestDateDep(fioTestStart)
    const fio = createRefusingFio(clock)
    await using jobRun = createFioDeviceRun({ evolu, clock, fetch: fio.fetch })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect.poll(() => fio.requestedAtSeconds).toEqual([0])
    for (let second = 30; second <= 120; second += 30) {
      await advanceFioClock(clock, 30_000)
      if (second === 30 || second === 90) {
        await expect.poll(() => fio.requestedAtSeconds).toContain(second)
      }
    }

    expect(fio.requestedAtSeconds).toEqual([0, 30, 90])
  })

  test("waits for a resting token instead of counting the wait as a failed sync", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await activateFioPlugin(evolu, {
      secondsPerToken: 10,
      tokens: ["fio-token-1"],
    })
    const clock = createTestDateDep(fioTestStart)
    const fio = createRefusingFio(clock)
    await using jobRun = createFioDeviceRun({ evolu, clock, fetch: fio.fetch })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())
    const expectedSeconds = [0, 30, 60, 100, 180]

    await expect.poll(() => fio.requestedAtSeconds).toEqual([0])
    for (let second = 10; second <= 180; second += 10) {
      await advanceFioClock(clock, 10_000)
      if (expectedSeconds.includes(second)) {
        await expect.poll(() => fio.requestedAtSeconds).toContain(second)
      }
    }

    expect(fio.requestedAtSeconds).toEqual(expectedSeconds)
  })

  test("asks FIO again the moment a resting token comes free", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1"],
    })
    const clock = createTestDateDep(fioTestStart)
    const fio = createSharedFio(clock)
    const console = testCreateConsole()
    await using device = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("A"),
      console,
    })
    await using _job = await device.ok(createFioAccountTransactionSyncJob())
    await expect.poll(() => fio.requests).toEqual(["A 0 s 200"])

    clock.advance(29_995)
    await vi.advanceTimersByTimeAsync(30_000)
    await expect
      .poll(() => loggedMessages(console))
      .toContain("Skipped FIO sync while every token rests.")
    await advanceFioClock(clock, 5)

    await expect.poll(() => fio.requests).toEqual(["A 0 s 200", "A 30 s 200"])
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
    const [firstToken, secondToken] = (
      await evolu.loadQuery(fioPluginTokensByPluginIdQuery(fioPluginId))
    ).map(({ token }) => token)
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      deviceId: createRowId<"Device">(),
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
      `https://fioapi.fio.cz/v1/rest/periods/${firstToken}/2026-03-31/2026-05-31/transactions.json`,
      `https://fioapi.fio.cz/v1/rest/periods/${secondToken}/2026-05-30/2026-05-31/transactions.json`,
    ])
    expect(errors).toEqual([])
  })

  test("checks n times as often with n tokens, using them in turn", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const requestedTokens: string[] = []
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
        numberOfSecondsBetweenChecks: PositiveInteger(4),
        isActive: sqliteTrue,
      })
    )
    for (const token of [
      "fio-token-1",
      "fio-token-2",
      "fio-token-3",
      "fio-token-4",
    ]) {
      await run.ok(
        addFioPluginToken({ fioPluginId, token: NonEmptyString255(token) })
      )
    }
    const tokensInTurn = (
      await evolu.loadQuery(fioPluginTokensByPluginIdQuery(fioPluginId))
    ).map(({ token }) => token)
    await using jobRun = testCreateRun({
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      deviceId: createRowId<"Device">(),
      onError: () => undefined,
      fetch: async (input: RequestInfo | URL) => {
        requestedTokens.push(inputToString(input).split("/")[6] ?? "")
        return statementResponse({ transactions: [] })
      },
      ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
    })
    await using _job = await jobRun.ok(createFioAccountTransactionSyncJob())

    await expect
      .poll(() => requestedTokens.length, { timeout: 3_000 })
      .toBeGreaterThanOrEqual(3)

    expect(requestedTokens.slice(0, 3)).toEqual(tokensInTurn.slice(0, 3))
  })

  test("two devices sharing tokens never use one inside FIO's 30 s limit", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1", "fio-token-2"],
    })
    const clock = createTestDateDep(fioTestStart)
    const fio = createSharedFio(clock)
    await using deviceA = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("A"),
    })
    await using deviceB = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("B"),
    })
    await using _jobA = await deviceA.ok(createFioAccountTransactionSyncJob())
    await expect.poll(() => fio.requests).toHaveLength(1)
    await using _jobB = await deviceB.ok(createFioAccountTransactionSyncJob())

    for (let step = 0; step < 8; step++) {
      const requestCount = fio.requests.length
      await advanceFioClock(clock, 15_000)
      await expect.poll(() => fio.requests.length).toBeGreaterThan(requestCount)
    }

    expect(fio.requests).toEqual(
      [0, 15, 30, 45, 60, 75, 90, 105, 120].map((second) => `A ${second} s 200`)
    )
  })

  test("the other device polls 30 s after the poller stops", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1", "fio-token-2"],
    })
    const clock = createTestDateDep(fioTestStart)
    const fio = createSharedFio(clock)
    const consoleB = testCreateConsole()
    await using deviceA = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("A"),
    })
    await using deviceB = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("B"),
      console: consoleB,
    })
    const jobA = await deviceA.ok(createFioAccountTransactionSyncJob())
    await expect.poll(() => fio.requests).toEqual(["A 0 s 200"])
    await using _jobB = await deviceB.ok(createFioAccountTransactionSyncJob())
    await expect
      .poll(() => loggedMessages(consoleB))
      .toContain("Skipped FIO sync while another device holds the lease.")

    await jobA[Symbol.asyncDispose]()
    await advanceFioClock(clock, 15_000)
    await expect
      .poll(() => loggedMessages(consoleB))
      .toContain("Skipped FIO sync while every token rests.")
    await advanceFioClock(clock, 15_000)
    await expect.poll(() => fio.requests).toEqual(["A 0 s 200", "B 30 s 200"])
    await advanceFioClock(clock, 15_000)

    await expect
      .poll(() => fio.requests)
      .toEqual(["A 0 s 200", "B 30 s 200", "B 45 s 200"])
  })

  test("a device that runs clearly more takes the lease over without a 409", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1", "fio-token-2"],
    })
    const deviceBId = createRowId<"Device">()
    await saveFioSyncUptime(evolu, {
      deviceId: deviceBId,
      uptimePerMille: 950,
      measuredAt: fioTestStart.getTime(),
    })
    const clock = createTestDateDep(fioTestStart)
    const fio = createSharedFio(clock)
    const consoleA = testCreateConsole()
    const consoleB = testCreateConsole()
    await using deviceA = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("A"),
      console: consoleA,
    })
    await using deviceB = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("B"),
      deviceId: deviceBId,
      console: consoleB,
    })
    await using _jobA = await deviceA.ok(createFioAccountTransactionSyncJob())
    await expect.poll(() => fio.requests).toEqual(["A 0 s 200"])
    await using _jobB = await deviceB.ok(createFioAccountTransactionSyncJob())
    await expect
      .poll(() => loggedMessages(consoleB))
      .toContain("Skipped FIO sync while every token rests.")

    await advanceFioClock(clock, 15_000)
    await expect
      .poll(() => loggedMessages(consoleA))
      .toContain("Skipped FIO sync while another device holds the lease.")
    for (const second of [30, 45, 60]) {
      await advanceFioClock(clock, 15_000)
      await expect.poll(() => fio.requests).toContain(`B ${second} s 200`)
    }

    expect(fio.requests).toEqual([
      "A 0 s 200",
      "B 30 s 200",
      "B 45 s 200",
      "B 60 s 200",
    ])
  })

  test("a poller in a backoff longer than the lease loses it", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await activateFioPlugin(evolu, {
      secondsPerToken: 60,
      tokens: ["fio-token-1"],
    })
    const clock = createTestDateDep(fioTestStart)
    const fio = createSharedFio(clock)
    const consoleB = testCreateConsole()
    const failedAtSeconds: number[] = []
    await using deviceA = createFioDeviceRun({
      evolu,
      clock,
      fetch: async () => {
        failedAtSeconds.push(secondsSinceFioTestStart(clock))
        return new Response("Service unavailable", { status: 500 })
      },
    })
    await using deviceB = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("B"),
      console: consoleB,
    })
    await using _jobA = await deviceA.ok(createFioAccountTransactionSyncJob())
    await expect.poll(() => failedAtSeconds).toEqual([0])
    await using _jobB = await deviceB.ok(createFioAccountTransactionSyncJob())

    const checkSeconds = 60
    const backoffFailures = [0, 60, 180, 420, 900]
    const leaseLapsesAt = 900 + 600
    const firstPollByB = leaseLapsesAt + checkSeconds
    for (
      let second = checkSeconds;
      second <= firstPollByB;
      second += checkSeconds
    ) {
      await advanceFioClock(clock, checkSeconds * 1000)
      if (backoffFailures.includes(second)) {
        await expect.poll(() => failedAtSeconds).toContain(second)
      }
      if (second === leaseLapsesAt) {
        await expect
          .poll(() => loggedMessages(consoleB))
          .toContain("Skipped FIO sync while every token rests.")
      }
    }

    await expect.poll(() => fio.requests).toEqual([`B ${firstPollByB} s 200`])
    expect(failedAtSeconds).toEqual(backoffFailures)
  })

  test("a device keeps its uptime across restarts and counts a suspension as off", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deviceId = createRowId<"Device">()
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    await saveFioSyncUptime(evolu, {
      deviceId,
      uptimePerMille: 800,
      measuredAt: fioTestStart.getTime() - day,
    })
    const clock = createTestDateDep(fioTestStart)
    const console = testCreateConsole()
    await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1"],
    })
    await using device = createFioDeviceRun({
      evolu,
      clock,
      fetch: createSharedFio(clock).as("A"),
      deviceId,
      console,
    })
    const job = await device.ok(createFioAccountTransactionSyncJob())
    const afterADayOff = fioSyncUptimeAfterOff({ uptime: 0.8, elapsedMs: day })
    await expect
      .poll(() => evolu.loadQuery(fioSyncDeviceUptimeByDeviceIdQuery(deviceId)))
      .toEqual([
        {
          uptimePerMille: Math.round(afterADayOff * 1000),
          measuredAt: fioTestStart.getTime(),
        },
      ])

    for (let step = 0; step < 30; step++) {
      await advanceFioClock(clock, minute)
    }
    const afterHalfAnHour = fioSyncUptimeAfterRunning({
      uptime: afterADayOff,
      elapsedMs: 30 * minute,
    })
    await expect
      .poll(() => evolu.loadQuery(fioSyncDeviceUptimeByDeviceIdQuery(deviceId)))
      .toEqual([
        {
          uptimePerMille: Math.round(afterHalfAnHour * 1000),
          measuredAt: fioTestStart.getTime() + 30 * minute,
        },
      ])

    clock.advance(hour)
    await advanceFioClock(clock, minute)
    await job[Symbol.asyncDispose]()
    const afterSuspension = fioSyncUptimeAfterOff({
      uptime: afterHalfAnHour,
      elapsedMs: hour + minute,
    })

    await expect
      .poll(() => evolu.loadQuery(fioSyncDeviceUptimeByDeviceIdQuery(deviceId)))
      .toEqual([
        {
          uptimePerMille: Math.round(afterSuspension * 1000),
          measuredAt: fioTestStart.getTime() + 91 * minute,
        },
      ])
  })

  test("a device keeps its lease when the plugin's tokens change", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deviceId = createRowId<"Device">()
    const clock = createTestDateDep(fioTestStart)
    const console = testCreateConsole()
    const fioPluginId = await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1"],
    })
    const upsert = vi.spyOn(evolu, "upsert")
    await using device = createFioDeviceRun({
      evolu,
      clock,
      fetch: createSharedFio(clock).as("A"),
      deviceId,
      console,
    })
    const job = await device.ok(createFioAccountTransactionSyncJob())
    await expect
      .poll(() => loggedMessages(console))
      .toContain("Finished FIO transaction sync.")

    await using run = testCreateRun(evoluTestDeps(evolu))
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-2"),
      })
    )
    await expect
      .poll(() => loggedMessages(console))
      .toContain("Started FIO transaction sync.")
    const leaseWrites = upsert.mock.calls.filter(
      ([table]) => table === "fioPluginSyncLease"
    )
    await job[Symbol.asyncDispose]()

    expect(leaseWrites).toHaveLength(1)
  })

  test("a replaced sync never asks FIO with a token inside the 30 s its predecessor started", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const clock = createTestDateDep(fioTestStart)
    const fio = createSharedFio(clock)
    const console = testCreateConsole()
    const fioPluginId = await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1"],
    })
    await using device = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("A"),
      console,
    })
    await using _job = await device.ok(createFioAccountTransactionSyncJob())
    await expect.poll(() => fio.requests).toEqual(["A 0 s 200"])

    await using run = testCreateRun(evoluTestDeps(evolu))
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-2"),
      })
    )
    const messages: unknown[] = []
    await expect
      .poll(() => {
        messages.push(...loggedMessages(console))
        return messages.filter(
          (message) => message === "Started FIO transaction sync."
        )
      })
      .toHaveLength(2)
    await advanceFioClock(clock, 15_000)
    await advanceFioClock(clock, 15_000)

    await expect.poll(() => fio.requests).toContain("A 30 s 200")
    expect(fio.requests.filter((request) => request.endsWith("409"))).toEqual(
      []
    )
  })

  test("a device whose last FIO plugin stops measures no more uptime", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deviceId = createRowId<"Device">()
    const clock = createTestDateDep(fioTestStart)
    const fio = createSharedFio(clock)
    const fioPluginId = await activateFioPlugin(evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1"],
    })
    await using device = createFioDeviceRun({
      evolu,
      clock,
      fetch: fio.as("A"),
      deviceId,
    })
    const job = await device.ok(createFioAccountTransactionSyncJob())
    await expect.poll(() => fio.requests).toEqual(["A 0 s 200"])
    await advanceFioClock(clock, 10 * 60_000)
    const stoppedAt = clock.date.now().getTime()

    await using run = testCreateRun(evoluTestDeps(evolu))
    await run.ok(deleteFioPlugin(fioPluginId))
    await expect
      .poll(() => evolu.loadQuery(fioSyncDeviceUptimeByDeviceIdQuery(deviceId)))
      .toMatchObject([{ measuredAt: stoppedAt }])
    await advanceFioClock(clock, 60 * 60_000)
    await job[Symbol.asyncDispose]()

    expect(
      await evolu.loadQuery(fioSyncDeviceUptimeByDeviceIdQuery(deviceId))
    ).toMatchObject([{ measuredAt: stoppedAt }])
  })

  test("a device that syncs no FIO plugin measures no uptime", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deviceId = createRowId<"Device">()
    const clock = createTestDateDep(fioTestStart)
    const console = testCreateConsole()
    await using device = createFioDeviceRun({
      evolu,
      clock,
      fetch: createSharedFio(clock).as("A"),
      deviceId,
      console,
    })
    const job = await device.ok(createFioAccountTransactionSyncJob())
    await expect
      .poll(() => loggedMessages(console))
      .toContain("Refreshing FIO plugin syncs.")
    await advanceFioClock(clock, 60 * 60_000)
    await job[Symbol.asyncDispose]()

    expect(
      await evolu.loadQuery(fioSyncDeviceUptimeByDeviceIdQuery(deviceId))
    ).toEqual([])
  })

  test("a device that stops releases its lease and saves its uptime before its database closes", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    const cwd = process.cwd()
    process.chdir(mkdtempSync(join(tmpdir(), "payky-fio-sync-")))
    onTestFinished(() => process.chdir(cwd))
    const deviceId = createRowId<"Device">()
    const minute = 60_000
    const clock = createTestDateDep(fioTestStart)
    const console = testCreateConsole()
    await using closing = await createNodeEvolu("file")
    const fioPluginId = await activateFioPlugin(closing.evolu, {
      secondsPerToken: 30,
      tokens: ["fio-token-1"],
    })
    await using device = createFioDeviceRun({
      evolu: closing.evolu,
      clock,
      fetch: createSharedFio(clock).as("A"),
      deviceId,
      console,
    })
    const job = await device.ok(createFioAccountTransactionSyncJob())
    await expect
      .poll(() => loggedMessages(console))
      .toContain("Finished FIO transaction sync.")
    await advanceFioClock(clock, minute)

    await job[Symbol.asyncDispose]()
    await closing[Symbol.asyncDispose]()
    await using reopened = await createNodeEvolu("file")

    expect(
      await reopened.evolu.loadQuery(
        fioPluginSyncLeaseByPluginIdQuery(fioPluginId)
      )
    ).toEqual([{ deviceId, expiresAt: fioTestStart.getTime() + minute }])
    expect(
      await reopened.evolu.loadQuery(
        fioSyncDeviceUptimeByDeviceIdQuery(deviceId)
      )
    ).toEqual([
      {
        uptimePerMille: Math.round(
          fioSyncUptimeAfterRunning({ uptime: 0, elapsedMs: minute }) * 1000
        ),
        measuredAt: fioTestStart.getTime() + minute,
      },
    ])
  })

  test("switches to a replacement token set without restarting the job", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const requestedUrls: string[] = []
    const clock = createTestDateDep(new Date("2026-05-31T10:00:00.000Z"))
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
      deviceId: createRowId<"Device">(),
      onError: (error: unknown) => {
        errors.push(error)
      },
      fetch: async (input: RequestInfo | URL) => {
        requestedUrls.push(inputToString(input))
        return statementResponse({ transactions: [] })
      },
      ...clock,
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

    await expect
      .poll(
        () => {
          clock.advance(30_000)
          return requestedUrls.filter((url) => url.includes("fio-token-fresh"))
            .length
        },
        {
          timeout: 5_000,
        }
      )
      .toBeGreaterThanOrEqual(2)

    // And nothing went back to the revoked token after it was removed.
    const firstFresh = requestedUrls.findIndex((url) =>
      url.includes("fio-token-fresh")
    )
    expect(
      requestedUrls
        .slice(firstFresh)
        .some((url) => url.includes("fio-token-stale"))
    ).toBe(false)
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
      deviceId: createRowId<"Device">(),
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

describe("fio account transaction sync job, self-pay", () => {
  test("credits a self-pay bill from the reference and pointer a statement carries", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    await activateSelfPayFioPlugin(context)
    const errors: unknown[] = []

    await using _sync = await startSelfPayFioSync(
      context,
      [
        selfPayStatementLine({
          id: 1,
          reference,
          amount: 450,
          message: formatSelfPayBankMessage({ pointer }),
        }),
      ],
      errors
    )

    await expect.poll(() => billStatusOf(context, billId)).toBe("closed")
    expect(
      await context.deps.evolu.loadQuery(selfPayPointersByBillIdQuery(billId))
    ).toEqual([{ pointer }])
    expect(errors).toEqual([])
  })

  test("credits each bill of one statement with its own transfer", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    const soup = await openSelfPayBill(context, {
      lines: [{ name: "Soup", amount: 30_000 }],
    })
    await activateSelfPayFioPlugin(context)
    const errors: unknown[] = []

    await using _sync = await startSelfPayFioSync(
      context,
      [
        selfPayStatementLine({ id: 1, reference: menu.reference, amount: 450 }),
        selfPayStatementLine({ id: 2, reference: soup.reference, amount: 300 }),
      ],
      errors
    )

    await expect.poll(() => billStatusOf(context, menu.billId)).toBe("closed")
    await expect.poll(() => billStatusOf(context, soup.billId)).toBe("closed")
    expect(errors).toEqual([])
  })

  test("pays a self-pay bill once from a statement downloaded twice", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    const fioPluginId = await activateSelfPayFioPlugin(context)
    const statement = [
      selfPayStatementLine({
        id: 1,
        reference,
        amount: 450,
        message: formatSelfPayBankMessage({ pointer }),
      }),
    ]
    const errors: unknown[] = []
    {
      await using _sync = await startSelfPayFioSync(context, statement, errors)
      await expect.poll(() => billStatusOf(context, billId)).toBe("closed")
    }
    context.clock.advance(24 * 60 * 60 * 1000)

    {
      await using _sync = await startSelfPayFioSync(context, statement, errors)
      await expect
        .poll(() =>
          context.deps.evolu.loadQuery(fioPluginSyncPointerQuery(fioPluginId))
        )
        .toMatchObject([{ lastSyncedDate: "2026-06-06" }])
    }

    expect(
      await context.deps.evolu.loadQuery(selfPayPointersByBillIdQuery(billId))
    ).toEqual([{ pointer }])
    expect(errors).toEqual([])
  })

  test("pairs a self-pay transfer recorded by a sync that stopped before pairing it", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    await using run = testCreateRun(context.deps)
    await run.ok(
      createAccountTransaction({
        accountId: context.ibanAccountId,
        amount: Integer(45_000),
        currency: "CZK",
        occurredAt: context.clock.date.now().getTime(),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId: null, source: "auto" },
        iban: {
          variableSymbol: VariableSymbol(reference),
          constantSymbol: null,
          specificSymbol: null,
          bankReference: NonEmptyString255("1"),
        },
      })
    )
    await activateSelfPayFioPlugin(context)
    const errors: unknown[] = []

    await using _sync = await startSelfPayFioSync(
      context,
      [selfPayStatementLine({ id: 1, reference, amount: 450 })],
      errors
    )

    await expect.poll(() => billStatusOf(context, billId)).toBe("closed")
    expect(
      await context.deps.evolu.loadQuery(selfPayPointersByBillIdQuery(billId))
    ).toHaveLength(1)
    expect(
      await context.deps.evolu.loadQuery(
        ibanTransactionsByAccountIdQuery(context.ibanAccountId)
      )
    ).toHaveLength(1)
    expect(errors).toEqual([])
  })

  test("pairs a transfer that arrived before this device knew the bill on a later sync", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    const setReferenceDeleted = (isDeleted: SqliteBoolean) =>
      runMutationWithCompletion((options) =>
        context.deps.evolu.update(
          "billSelfPayReference",
          { id: billId, isDeleted },
          { ...options, owner: context.deps.evoluOwner }
        )
      )
    await activateSelfPayFioPlugin(context)
    const statement = [selfPayStatementLine({ id: 1, reference, amount: 450 })]
    const errors: unknown[] = []
    await setReferenceDeleted(sqliteTrue)
    {
      await using _sync = await startSelfPayFioSync(context, statement, errors)
      await expect
        .poll(() =>
          context.deps.evolu.loadQuery(
            ibanTransactionsByAccountIdQuery(context.ibanAccountId)
          )
        )
        .toHaveLength(1)
    }
    expect(await billStatusOf(context, billId)).toBe("open")
    await setReferenceDeleted(sqliteFalse)

    await using _sync = await startSelfPayFioSync(context, statement, errors)

    await expect.poll(() => billStatusOf(context, billId)).toBe("closed")
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

describe("FIO sync lease", () => {
  const deviceId = createRowId<"Device">()
  const otherDeviceId = createRowId<"Device">()
  const now = fioTestStart.getTime()
  const minute = 60_000

  test("the first device to check takes a free plugin", () => {
    expect(
      decideFioSyncLease({
        lease: undefined,
        deviceId,
        uptime: 0,
        holderUptime: 0,
        now,
      })
    ).toEqual({ poll: true, renewLease: true, takenOverAt: null })
  })

  test("a device renews its own lease once 5 minutes or less are left", () => {
    const decide = (expiresAt: number) =>
      decideFioSyncLease({
        lease: { deviceId, expiresAt },
        deviceId,
        uptime: 0,
        holderUptime: 0,
        now,
      })

    expect(decide(now + 6 * minute)).toEqual({
      poll: true,
      renewLease: false,
      takenOverAt: null,
    })
    expect(decide(now + 5 * minute)).toEqual({
      poll: true,
      renewLease: true,
      takenOverAt: null,
    })
  })

  test("a device leaves a live lease to a device that runs about as much", () => {
    expect(
      decideFioSyncLease({
        lease: { deviceId: otherDeviceId, expiresAt: now + minute },
        deviceId,
        uptime: 0.45,
        holderUptime: 0.4,
        now,
      })
    ).toEqual({ poll: false })
  })

  test("a device that runs 10 points more takes a live lease over from now", () => {
    expect(
      decideFioSyncLease({
        lease: { deviceId: otherDeviceId, expiresAt: now + minute },
        deviceId,
        uptime: 0.5,
        holderUptime: 0.4,
        now,
      })
    ).toEqual({ poll: true, renewLease: true, takenOverAt: now })
  })

  test("an expired or released lease is taken over from the moment it ended", () => {
    expect(
      decideFioSyncLease({
        lease: { deviceId: otherDeviceId, expiresAt: now - 10_000 },
        deviceId,
        uptime: 0,
        holderUptime: 1,
        now,
      })
    ).toEqual({ poll: true, renewLease: true, takenOverAt: now - 10_000 })
  })
})

describe("FIO sync uptime", () => {
  const day = 24 * 60 * 60 * 1000

  test("a day running moves uptime 1 - 1/e of the way to 100 %", () => {
    expect(
      fioSyncUptimeAfterRunning({ uptime: 0, elapsedMs: day })
    ).toBeCloseTo(1 - 1 / Math.E)
  })

  test("a day off keeps 1/e of the uptime", () => {
    expect(fioSyncUptimeAfterOff({ uptime: 1, elapsedMs: day })).toBeCloseTo(
      1 / Math.E
    )
  })

  test("a clock that steps back leaves uptime as it was", () => {
    expect(fioSyncUptimeAfterRunning({ uptime: 0, elapsedMs: -60_000 })).toBe(0)
    expect(fioSyncUptimeAfterOff({ uptime: 1, elapsedMs: -60_000 })).toBe(1)
  })
})

describe("FIO check interval", () => {
  test("divides one token's interval among the tokens", () => {
    expect(getFioCheckIntervalMs(30, 1)).toBe(30_000)
    expect(getFioCheckIntervalMs(30, 3)).toBe(10_000)
    expect(getFioCheckIntervalMs(30, 7)).toBe(4286)
  })
})
