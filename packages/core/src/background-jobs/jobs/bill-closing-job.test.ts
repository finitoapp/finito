import {
  createIdFromString,
  sqliteFalse,
  testCreateConsole,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createDateDep } from "../../deps.ts"
import type { Evolu } from "../../evolu/schema.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import { createNostrRelayClient } from "../../integrations/nostr/nostr-relay-client.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import { createAccount } from "../../modules/account/account-actions.ts"
import type { AccountId } from "../../modules/account/account-types.ts"
import {
  createAccountTransaction,
  deleteAccountTransaction,
} from "../../modules/account-transaction/account-transaction-actions.ts"
import type { AccountTransactionId } from "../../modules/account-transaction/account-transaction-types.ts"
import {
  addManualAmountToBill,
  appendRemoveBillLine,
  createBill,
  reconcileBillsClosedAt,
} from "../../modules/bill/bill-actions.ts"
import { loadBillCoveredSince } from "../../modules/bill/bill-closing-guards.ts"
import { syncClockMillis } from "../../modules/bill/bill-closing-utils.ts"
import {
  billByIdQuery,
  openBillsQuery,
} from "../../modules/bill/bill-queries.ts"
import type { BillId } from "../../modules/bill/bill-types.ts"
import {
  calculateClaimedSum,
  deriveOpenBillTableId,
} from "../../modules/bill/bill-utils.ts"
import {
  appendBillLines,
  loadCalculatedBillLineSummaries,
} from "../../modules/bill-line/bill-line-actions.ts"
import {
  CashuQuoteIdSchema,
  MintUrlSchema,
} from "../../modules/cashu/cashu-types.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import type { PaymentId } from "../../modules/payment/payment-types.ts"
import { claimManualReconciliation } from "../../modules/reconciliation-claim/reconciliation-claim-actions.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../../modules/shared/evolu-utils.ts"
import {
  IbanSchema,
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumberSchema,
  TimestampMs,
} from "../../modules/shared/schema.ts"
import { createTable, deleteTable } from "../../modules/table/table-actions.ts"
import type { TableId } from "../../modules/table/table-types.ts"
import { tableSelfPayBillsQuery } from "../../modules/table-self-pay/table-self-pay-queries.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createSparkWalletDep } from "../../spark/spark-wallet.ts"
import { testSyncedAppOwner } from "../../testing/app-owner-sync.ts"
import { testNotificationsDep } from "../../testing/background-jobs.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import {
  createSyncedDevices,
  type SyncedDevice,
} from "../../testing/evolu-sync.ts"
import { createSeededRandom } from "../../testing/seeded-random.ts"
import type { AppBackgroundJobContext } from "../background-job-types.ts"
import { createBillClosingJob } from "./bill-closing-job.ts"

const hour = 3_600_000

const depsOf = (evolu: Evolu) => ({
  ...evoluTestDeps(evolu),
  ...createDateDep(),
})

const startClosingJob = async (
  evolu: Evolu,
  appOwnerSync: AppBackgroundJobContext["appOwnerSync"] = testSyncedAppOwner.appOwnerSync
) => {
  const errors: unknown[] = []
  const dateDep = createDateDep()
  const fetch = async () => new Response("{}")
  const jobDeps: AppBackgroundJobContext = {
    ...depsOf(evolu),
    ...dateDep,
    ...createEetApiDep({ ...dateDep, fetch }),
    ...createQerkoApiDep({ posId: "test" }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(),
    ...createSparkWalletDep(),
    ...createYadioApiDep(),
    appOwnerSync,
    console: testCreateConsole(),
    fetch,
    lockManager: createInProcessLockManager(),
    ...testNotificationsDep(),
    deviceId: createRowId<"Device">(),
    connectivity: { onOnline: () => () => undefined },
    nostrRelayClient: createNostrRelayClient(),
    selfPayDefaultRelays: [],
    tableSelfPayRoot: new Uint8Array(32),
    onError: (error) => {
      errors.push(error)
    },
  }
  const run = testCreateRun(jobDeps)
  const job = await run.ok(createBillClosingJob({ debounceMs: 20 }))
  return {
    errors,
    [Symbol.asyncDispose]: async () => {
      await job[Symbol.asyncDispose]()
      await run[Symbol.asyncDispose]()
    },
  }
}

const createTableOn = async (evolu: Evolu): Promise<TableId> => {
  await using run = testCreateRun(depsOf(evolu))
  return await run.ok(
    createTable({
      name: NonEmptyString255("Table 1"),
      code: NonEmptyString255("T1"),
      seatCount: PositiveInteger(4),
      sortOrder: NonNegativeInteger(0),
    })
  )
}

const openBillOn = async (
  evolu: Evolu,
  tableId: TableId | null,
  lines: ReadonlyArray<readonly [string, number]>
): Promise<BillId> => {
  await using run = testCreateRun(depsOf(evolu))
  const billId = await run.ok(
    createBill({
      deviceId: null,
      displayNumber: PositiveInteger(1),
      label: null,
      tableId,
      currency: "CZK",
    })
  )
  for (const [name, amount] of lines) {
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255(name),
        currency: "CZK",
        totalAmount: NonNegativeInteger(amount),
      })
    )
  }
  return billId
}

const createPaymentOn = async (
  evolu: Evolu,
  billId: BillId,
  amount: number
): Promise<PaymentId> => {
  await using run = testCreateRun(depsOf(evolu))
  return await run.orThrow(
    createPayment({
      deviceId: null,
      billId,
      tableId: null,
      amount: NonNegativeInteger(amount),
      currency: "CZK",
      tipAmount: NonNegativeInteger(0),
      canceledAt: null,
      expiresAt: null,
    })
  )
}

const createBankAccountOn = async (evolu: Evolu): Promise<AccountId> => {
  await using run = testCreateRun(depsOf(evolu))
  return await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Bank account"),
      iban: {
        iban: IbanSchema.decode("CZ6508000000192000145399"),
        currency: "CZK",
      },
    })
  )
}

const settleOn = async (
  evolu: Evolu,
  accountId: AccountId,
  paymentId: PaymentId,
  amount: number
): Promise<AccountTransactionId> => {
  await using run = testCreateRun(depsOf(evolu))
  const accountTransactionId = await run.ok(
    createAccountTransaction({
      accountId,
      amount: Integer(amount),
      currency: "CZK",
      occurredAt: TimestampMs(Date.now()),
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "manual" },
    })
  )
  await run.ok(
    claimManualReconciliation({
      paymentId,
      accountTransactionId,
      deviceId: null,
    })
  )
  return accountTransactionId
}

const settleByCashuOn = async (
  evolu: Evolu,
  paymentId: PaymentId,
  sats: number
): Promise<void> => {
  const { evoluOwner } = evoluTestDeps(evolu)
  const accountId = createIdFromString<"Account">("cashu")
  const accountTransactionId = createRowId<"AccountTransaction">()
  await runMutationWithCompletion((options) => {
    evolu.upsert(
      "accountCashu",
      { id: accountId },
      { ...options, owner: evoluOwner }
    )
    evolu.upsert(
      "account",
      {
        id: accountId,
        deviceId: null,
        name: NonEmptyString255("Cashu"),
        kind: "cashu",
        isDeleted: sqliteFalse,
      },
      { ...options, owner: evoluOwner }
    )
    evolu.upsert(
      "paymentCashu",
      {
        id: paymentId,
        accountId,
        amountSats: NonNegativeInteger(sats),
        exchangeRate: PositiveNumberSchema.decode(2.5),
        exchangeRateSource: "yadio",
        exchangeRateFetchedAt: TimestampMs(Date.now()),
        mintUrl: MintUrlSchema.decode("https://mint.example.com"),
        quoteId: CashuQuoteIdSchema.decode("quote"),
        lnInvoice: NonEmptyStringSchema.decode("lnbc1"),
        quoteExpiresAt: null,
        receiveOperationId: null,
      },
      { ...options, owner: evoluOwner }
    )
    evolu.upsert(
      "accountTransaction",
      {
        id: accountTransactionId,
        accountId,
        kind: "cashu",
        amount: Integer(sats),
        currency: "BTC",
        occurredAt: TimestampMs(Date.now()),
        note: null,
        internalTransferGroupId: null,
      },
      { ...options, owner: evoluOwner }
    )
  })
  await using run = testCreateRun(depsOf(evolu))
  await run.ok(
    claimManualReconciliation({
      paymentId,
      accountTransactionId,
      deviceId: null,
    })
  )
}

const removeLineOn = async (
  evolu: Evolu,
  billId: BillId,
  name: string,
  { asEdit }: { readonly asEdit: boolean }
) => {
  await using run = testCreateRun(depsOf(evolu))
  const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
  const line = summaries.find((summary) => summary.name === name)
  if (line === undefined) throw new Error(`No line ${name}`)
  if (asEdit) {
    await run.orThrow(
      appendRemoveBillLine({
        billId,
        deviceId: null,
        lineSummary: line,
        quantity: line.quantity,
        totalAmount: line.totalAmount,
      })
    )
    return
  }
  await run.ok(
    appendBillLines([
      {
        billId,
        deviceId: null,
        catalogItemId: line.catalogItemId,
        itemId: line.itemId,
        type: line.type,
        kind: "remove",
        quantity: line.quantity,
        totalAmount: line.totalAmount,
      },
    ])
  )
}

const deleteTransactionOn = async (
  evolu: Evolu,
  accountTransactionId: AccountTransactionId
) => {
  await using run = testCreateRun(depsOf(evolu))
  await run.ok(deleteAccountTransaction(accountTransactionId))
}

const openBillIdsOn = async (evolu: Evolu) =>
  (await evolu.loadQuery(openBillsQuery)).map(({ id }) => id)

const closedAtOn = async (evolu: Evolu, billId: BillId) =>
  (await evolu.loadQuery(billByIdQuery(billId)))[0]?.closedAt ?? null

const historySizeQuery = createQuery((db) =>
  db.selectFrom("bill").select(["id", "closedAt", "updatedAt"])
)

const syncAll = async (devices: ReadonlyArray<SyncedDevice>) => {
  for (const device of devices) device.connect()
  await expect
    .poll(
      async () => {
        const views = await Promise.all(
          devices.map(async ({ evolu }) => ({
            bills: JSON.stringify(await evolu.loadQuery(historySizeQuery)),
            lines: (
              await evolu.loadQuery(
                createQuery((db) =>
                  db.selectFrom("billLine").select(["id", "isDeleted"])
                )
              )
            ).length,
            claims: (
              await evolu.loadQuery(
                createQuery((db) =>
                  db
                    .selectFrom("reconciliationClaim")
                    .select(["id", "isDeleted"])
                )
              )
            ).length,
            transactions: JSON.stringify(
              await evolu.loadQuery(
                createQuery((db) =>
                  db
                    .selectFrom("accountTransaction")
                    .select(["id", "isDeleted"])
                    .orderBy("id")
                )
              )
            ),
          }))
        )
        return views.every(
          (view) => JSON.stringify(view) === JSON.stringify(views[0])
        )
      },
      { timeout: 45_000 }
    )
    .toBe(true)
  for (const device of devices) device.disconnect()
}

describe("The bill reads the same everywhere", () => {
  test("Bill already stuck on the overview", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const closedSince = Date.now() - 85 * hour
    evolu.setMutationBackdate(closedSince - 60_000)
    const tableId = await createTableOn(evolu)
    const billId = await openBillOn(evolu, tableId, [
      ["Soup", 250],
      ["Tea", 250],
    ])
    const accountId = await createBankAccountOn(evolu)
    const paymentId = await createPaymentOn(evolu, billId, 250)
    await settleOn(evolu, accountId, paymentId, 250)
    evolu.setMutationBackdate(closedSince)
    await removeLineOn(evolu, billId, "Tea", { asEdit: false })
    evolu.setMutationBackdate(null)

    expect(await openBillIdsOn(evolu)).toContain(billId)

    await using job = await startClosingJob(evolu)

    await expect.poll(() => openBillIdsOn(evolu)).not.toContain(billId)
    expect(
      Math.abs(((await closedAtOn(evolu, billId)) ?? 0) - closedSince)
    ).toBeLessThanOrEqual(60_000)
    expect(job.errors).toEqual([])
  })

  test("Bill opened again by a deleted transaction", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const tableId = await createTableOn(evolu)
    const billId = await openBillOn(evolu, tableId, [["Dinner", 10_000]])
    const accountId = await createBankAccountOn(evolu)
    const paymentId = await createPaymentOn(evolu, billId, 10_000)
    const transfer = await settleOn(evolu, accountId, paymentId, 10_000)
    await using job = await startClosingJob(evolu)
    expect(await openBillIdsOn(evolu)).not.toContain(billId)

    await deleteTransactionOn(evolu, transfer)

    await expect.poll(() => openBillIdsOn(evolu)).toContain(billId)
    expect(await closedAtOn(evolu, billId)).toBeNull()
    expect(job.errors).toEqual([])
  })

  test("Bill paid by Cashu alone", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const tableId = await createTableOn(evolu)
    const billId = await openBillOn(evolu, tableId, [["Dinner", 10_000]])
    const paymentId = await createPaymentOn(evolu, billId, 10_000)
    await using job = await startClosingJob(evolu)

    await settleByCashuOn(evolu, paymentId, 4000)
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(await closedAtOn(evolu, billId)).not.toBeNull()
    expect(await openBillIdsOn(evolu)).not.toContain(billId)
    expect(job.errors).toEqual([])
  })

  test("Bill partly paid by Cashu shows on the floor what arrived", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const tableId = await createTableOn(evolu)
    const billId = await openBillOn(evolu, tableId, [["Dinner", 10_000]])
    const paymentId = await createPaymentOn(evolu, billId, 4000)

    await settleByCashuOn(evolu, paymentId, 1600)

    const open = (await evolu.loadQuery(openBillsQuery)).find(
      ({ id }) => id === billId
    )
    expect(calculateClaimedSum(open?.claims ?? [])).toBe(4000)
  })

  test("Closed by two devices at once", async () => {
    await using devices = await createSyncedDevices()
    const claiming = await devices.addDevice()
    const editing = await devices.addDevice()
    const tableId = await createTableOn(claiming.evolu)
    const billId = await openBillOn(claiming.evolu, tableId, [
      ["Soup", 250],
      ["Tea", 250],
    ])
    const accountId = await createBankAccountOn(claiming.evolu)
    await syncAll([claiming, editing])

    const paymentId = await createPaymentOn(claiming.evolu, billId, 250)
    const transfer = await settleOn(claiming.evolu, accountId, paymentId, 250)
    await removeLineOn(editing.evolu, billId, "Tea", { asEdit: true })
    await syncAll([claiming, editing])
    expect(await closedAtOn(editing.evolu, billId)).toBeNull()
    expect(await openBillIdsOn(editing.evolu)).toContain(billId)

    claiming.connect()
    editing.connect()
    await using job = await startClosingJob(
      claiming.evolu,
      claiming.appOwnerSync
    )

    await expect
      .poll(() => openBillIdsOn(editing.evolu), { timeout: 15_000 })
      .not.toContain(billId)
    await expect(
      editing.evolu.loadQuery(tableSelfPayBillsQuery(tableId))
    ).resolves.toEqual([])
    {
      await using run = testCreateRun(depsOf(editing.evolu))
      await expect(run(deleteTable(tableId))).resolves.toMatchObject({
        ok: true,
      })
    }

    await deleteTransactionOn(editing.evolu, transfer)

    await expect
      .poll(() => openBillIdsOn(editing.evolu), { timeout: 15_000 })
      .toContain(billId)
    const reopened = (await editing.evolu.loadQuery(openBillsQuery)).find(
      ({ id }) => id === billId
    )
    expect(
      deriveOpenBillTableId(reopened?.tableId ?? null, new Set<TableId>())
    ).toBeNull()
    expect(job.errors).toEqual([])
  }, 60_000)

  test("Bill closed on a device that missed a line", async () => {
    await using devices = await createSyncedDevices()
    const closing = await devices.addDevice()
    const adding = await devices.addDevice()
    const billId = await openBillOn(closing.evolu, null, [
      ["Steak", 5_000],
      ["Fries", 5_000],
    ])
    const accountId = await createBankAccountOn(closing.evolu)
    const paymentId = await createPaymentOn(closing.evolu, billId, 5_000)
    await settleOn(closing.evolu, accountId, paymentId, 5_000)
    await syncAll([closing, adding])
    await using job = await startClosingJob(adding.evolu, adding.appOwnerSync)

    await removeLineOn(closing.evolu, billId, "Fries", { asEdit: true })
    {
      await using run = testCreateRun(depsOf(adding.evolu))
      await run.orThrow(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Wine"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(3_000),
        })
      )
    }
    expect(await closedAtOn(closing.evolu, billId)).not.toBeNull()
    await syncAll([closing, adding])

    closing.connect()
    adding.connect()

    await expect
      .poll(() => openBillIdsOn(closing.evolu), { timeout: 15_000 })
      .toContain(billId)
    const reopened = (await closing.evolu.loadQuery(openBillsQuery)).find(
      ({ id }) => id === billId
    )
    {
      await using run = testCreateRun(depsOf(closing.evolu))
      const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
      expect(
        summaries.reduce((sum, { totalAmount }) => sum + totalAmount, 0)
      ).toBe(8_000)
    }
    expect(reopened?.closedAt ?? null).toBeNull()
    expect(job.errors).toEqual([])
  }, 60_000)
})

const closingModelRun = async (
  seed: number
): Promise<ReadonlyArray<string>> => {
  const random = createSeededRandom(seed)
  await using devices = await createSyncedDevices()
  const pair = [await devices.addDevice(), await devices.addDevice()] as const
  const [first] = pair
  const billId = await openBillOn(first.evolu, null, [])
  const accountId = await createBankAccountOn(first.evolu)
  await syncAll(pair)

  const names: string[] = []
  const transfers: AccountTransactionId[] = []
  for (let step = 0; step < 3 + random(10); step++) {
    const device = pair[random(2)] ?? first
    const action = random(100)
    if (action < 30) {
      const name = `L${names.length}`
      names.push(name)
      await using run = testCreateRun(depsOf(device.evolu))
      await run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255(name),
          currency: "CZK",
          totalAmount: NonNegativeInteger(
            [2_500, 5_000, 10_000][random(3)] ?? 2_500
          ),
        })
      )
    } else if (action < 42) {
      const name = names[random(Math.max(1, names.length))]
      if (name !== undefined) {
        await using run = testCreateRun(depsOf(device.evolu))
        const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
        if (summaries.some((summary) => summary.name === name)) {
          await removeLineOn(device.evolu, billId, name, { asEdit: false })
        }
      }
    } else if (action < 65) {
      const amount = [2_500, 5_000, 10_000][random(3)] ?? 2_500
      await using run = testCreateRun(depsOf(device.evolu))
      const payment = await run(
        createPayment({
          deviceId: null,
          billId,
          tableId: null,
          amount: NonNegativeInteger(amount),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
        })
      )
      if (payment.ok) {
        transfers.push(
          await settleOn(device.evolu, accountId, payment.value, amount)
        )
      }
    } else if (action < 72) {
      const transfer = transfers[random(Math.max(1, transfers.length))]
      if (transfer !== undefined)
        await deleteTransactionOn(device.evolu, transfer)
    } else if (action < 88) {
      await syncAll(pair)
    } else {
      await using run = testCreateRun(depsOf(device.evolu))
      await run.ok(reconcileBillsClosedAt([billId]))
    }
  }

  await syncAll(pair)
  let rounds = 0
  for (;;) {
    rounds += 1
    let wrote = false
    for (const device of pair) {
      await using run = testCreateRun(depsOf(device.evolu))
      if ((await run.ok(reconcileBillsClosedAt([billId]))).length > 0) {
        wrote = true
        await syncAll(pair)
      }
    }
    if (!wrote || rounds > 5) break
  }

  const problems: string[] = []
  const views = await Promise.all(
    pair.map(async ({ evolu }) => {
      await using run = testCreateRun(depsOf(evolu))
      return {
        closedAt: await closedAtOn(evolu, billId),
        coveredSince: await run.ok(loadBillCoveredSince(billId)),
      }
    })
  )
  if (JSON.stringify(views[0]) !== JSON.stringify(views[1])) {
    problems.push("devices disagree")
  }
  const [view] = views
  if (view !== undefined) {
    const isNear =
      view.coveredSince === null
        ? view.closedAt === null
        : view.closedAt !== null &&
          Math.abs(view.closedAt - syncClockMillis(view.coveredSince)) <= 60_000
    if (!isNear) problems.push("closedAt off the derived status")
  }
  if (rounds > 2) problems.push(`no convergence within one round (${rounds})`)
  return problems
}

describe("the closing job model's convergence check", () => {
  test.each(Array.from({ length: 24 }, (_, index) => index + 1))(
    "seed %i: after full sync every device agrees, closedAt matches the derived status, the job stops within one round",
    async (seed) => {
      expect(await closingModelRun(seed)).toEqual([])
    },
    120_000
  )
})
