import {
  SparkWalletEvent,
  type SparkWalletEvents,
} from "@buildonspark/spark-sdk"
import {
  createIdFromString,
  sqliteTrue,
  testCreateConsole,
  testCreateRun,
} from "@evolu/common"
import { subHours } from "date-fns"
import { describe, expect, test, vi } from "vitest"
import type { FetchDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createAccount } from "../../modules/account/account-actions.ts"
import type { AccountId } from "../../modules/account/account-types.ts"
import { createAccountTransaction } from "../../modules/account-transaction/account-transaction-actions.ts"
import { loadBillStatus } from "../../modules/bill/bill-guards.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import type { EvoluDep } from "../../modules/shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../../modules/shared/evolu-utils.ts"
import type { SparkSecret } from "../../modules/shared/key-derivation.ts"
import {
  createTestInvoice,
  testSparkIdentity,
} from "../../modules/shared/lightning-invoice-test-fixtures.ts"
import {
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  TimestampMs,
} from "../../modules/shared/schema.ts"
import { createSelfPayLightningRequest } from "../../modules/table-self-pay/table-self-pay-guest-utils.ts"
import { formatSelfPayLightningMemo } from "../../modules/table-self-pay/table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  createTestLightningInvoice,
  openSelfPayBill,
  selectSelfPayTestShare,
  selfPayPointersByBillIdQuery,
  signTestSelfPayRate,
} from "../../modules/table-self-pay/table-self-pay-test-fixtures.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createGuestLightningInvoice } from "../../spark/spark-guest-invoice.ts"
import type { SparkWalletTransfer } from "../../spark/spark-wallet.ts"
import { testNotificationsDep } from "../../testing/background-jobs.ts"
import { createTestDateDep, testFixedDate } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createSparkAccountTransactionSyncJob } from "./spark-account-transaction-sync-job.ts"

const unimplementedFetch: FetchDep["fetch"] = (() => {
  throw new Error("fetch is not implemented in this test.")
}) as unknown as FetchDep["fetch"]

const sparkTransactionsByAccountIdQuery = (accountId: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .innerJoin(
        "accountTransactionSpark",
        "accountTransactionSpark.id",
        "accountTransaction.id"
      )
      .leftJoin(
        "accountTransactionLightning",
        "accountTransactionLightning.id",
        "accountTransaction.id"
      )
      .leftJoin(
        "accountTransactionSparkInvoice",
        "accountTransactionSparkInvoice.id",
        "accountTransaction.id"
      )
      .select([
        "accountTransaction.accountId",
        "accountTransaction.amount",
        "accountTransaction.currency",
        "accountTransaction.occurredAt",
        "accountTransaction.note",
        "accountTransactionSpark.sparkTransferId",
        "accountTransactionLightning.lnInvoice",
        "accountTransactionSparkInvoice.sparkInvoice",
        "accountTransactionLightning.preImage",
        "accountTransactionLightning.paymentHash",
      ])
      .where("accountTransaction.accountId", "=", accountId)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
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

interface FakeTransfer {
  readonly id: string
  readonly status: string
  readonly type: string
  readonly valueSentByWallet: number
  readonly valueReceivedByWallet: number
  readonly transferDirection: string
  readonly updatedTime: Date | undefined
  readonly createdTime: Date | undefined
  readonly lnInvoice?: string | undefined
  readonly sparkInvoice: string | undefined
  readonly userRequest: unknown
}

class FakeSparkWallet {
  readonly disposals: unknown[] = []
  readonly getTransferIds: string[] = []
  readonly getTransfersCalls: Array<{
    readonly limit: number
    readonly offset: number
    readonly createdAfter: Date | undefined
  }> = []
  private readonly listeners = new Map<
    string,
    Set<(...args: ReadonlyArray<unknown>) => void>
  >()

  private readonly transfers: ReadonlyArray<FakeTransfer>

  constructor(transfers: ReadonlyArray<FakeTransfer>) {
    this.transfers = transfers
  }

  async getTransfers(limit = 20, offset = 0, createdAfter?: Date) {
    this.getTransfersCalls.push({ limit, offset, createdAfter })

    // Mirrors the real SDK: `createdAfter` narrows the set pagination then
    // walks — "strictly after", per its own doc comment.
    const filtered =
      createdAfter === undefined
        ? this.transfers
        : this.transfers.filter(
            (transfer) =>
              transfer.createdTime !== undefined &&
              transfer.createdTime.getTime() > createdAfter.getTime()
          )
    const transfers = filtered.slice(offset, offset + limit)
    const nextOffset =
      offset + transfers.length < filtered.length
        ? offset + transfers.length
        : offset

    return {
      // FakeTransfer intentionally implements only the subset of
      // SparkWalletTransfer that the sync job reads (see its own narrower
      // `SparkTransfer` interface).
      transfers: transfers as unknown as SparkWalletTransfer[],
      offset: nextOffset,
    }
  }

  async getTransfer(id: string) {
    this.getTransferIds.push(id)
    return this.transfers.find((transfer) => transfer.id === id) as
      | SparkWalletTransfer
      | undefined
  }

  private on(
    event: string,
    listener: (...args: ReadonlyArray<unknown>) => void
  ): void {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  private off(
    event: string,
    listener: (...args: ReadonlyArray<unknown>) => void
  ): void {
    this.listeners.get(event)?.delete(listener)
  }

  subscribe(handlers: Partial<SparkWalletEvents>): () => void {
    const entries = Object.entries(handlers).filter(
      (entry): entry is [string, (...args: ReadonlyArray<unknown>) => void] =>
        entry[1] !== undefined
    )

    for (const [event, listener] of entries) {
      this.on(event, listener)
    }

    return () => {
      for (const [event, listener] of entries) {
        this.off(event, listener)
      }
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.disposals.push(null)
    this.listeners.clear()
  }

  emit(event: string, ...args: ReadonlyArray<unknown>): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args)
    }
  }
}

const createCompletedTransfer = (
  override: Partial<FakeTransfer> = {}
): FakeTransfer => ({
  id: "spark-transfer-1",
  status: "TRANSFER_STATUS_COMPLETED",
  type: "TRANSFER",
  valueSentByWallet: 0,
  valueReceivedByWallet: 1234,
  transferDirection: "INCOMING",
  updatedTime: new Date("2026-05-27T10:00:00Z"),
  createdTime: new Date("2026-05-27T09:59:00Z"),
  sparkInvoice: "spark-invoice-1",
  userRequest: {
    invoice: {
      encodedInvoice: "lnbc1invoice",
      paymentHash: "payment-hash-1",
      memo: "Table 1",
    },
    paymentPreimage: "preimage-1",
  },
  ...override,
})

const createSelfPayTransfer = (encodedInvoice: string, receivedAt: Date) =>
  createCompletedTransfer({
    id: "spark-transfer-self-pay",
    valueReceivedByWallet: 18_000,
    createdTime: receivedAt,
    updatedTime: receivedAt,
    sparkInvoice: undefined,
    userRequest: {
      invoice: { encodedInvoice, paymentHash: "payment-hash-self-pay" },
      paymentPreimage: "preimage-self-pay",
    },
  })

let uniqueSecretCounter = 0

const createUniqueSecret = (): SparkSecret =>
  (uniqueSecretCounter++).toString(16).padStart(32, "0") as SparkSecret

const createFakeWalletFactory =
  (secret: SparkSecret, wallet: FakeSparkWallet) =>
  async (receivedSecret: SparkSecret): Promise<FakeSparkWallet> =>
    receivedSecret === secret ? wallet : new FakeSparkWallet([])

describe("spark account transaction sync job", () => {
  test("stores completed Spark transfers from the periodic history check without duplicates", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    })
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    const transferId = `spark-transfer-${accountId}`
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        spark: {
          accountId,
          amountSats: NonNegativeInteger(1_234),
          exchangeRate: PositiveNumber(1_500_000),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(1_700_000_000_000),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc1invoice"),
            lightningReceiveRequestId: null,
            paymentHash: NonEmptyStringSchema.decode("payment-hash-1"),
            paymentPreimage: null,
          },
        },
      })
    )
    const wallet = new FakeSparkWallet([
      createCompletedTransfer({
        id: transferId,
      }),
    ])
    const upsertSpy = vi.spyOn(evolu, "upsert")
    await using jobRun = testCreateRun({
      deviceId: createRowId<"Device">(),
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      fetch: unimplementedFetch,
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: createFakeWalletFactory(secret, wallet),
        recheckIntervalMs: 60_000,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toEqual([
        {
          accountId,
          amount: 1234,
          currency: "BTC",
          occurredAt: new Date("2026-05-27T10:00:00Z").getTime(),
          note: "Table 1",
          sparkTransferId: transferId,
          lnInvoice: "lnbc1invoice",
          sparkInvoice: "spark-invoice-1",
          preImage: "preimage-1",
          paymentHash: "payment-hash-1",
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

  test("narrows the periodic rescan to a 72h createdAfter window after the first sync", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    // No transfers at all — this test only cares about what `createdAfter`
    // each `getTransfers` call carries, not about recording anything.
    const wallet = new FakeSparkWallet([])
    await using jobRun = testCreateRun({
      deviceId: createRowId<"Device">(),
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      ...createTestDateDep(testFixedDate),
      fetch: unimplementedFetch,
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: createFakeWalletFactory(secret, wallet),
        recheckIntervalMs: 10,
      })
    )

    // First sync: no pointer yet, so the sweep is unbounded.
    await expect
      .poll(() => wallet.getTransfersCalls.length)
      .toBeGreaterThanOrEqual(1)
    expect(wallet.getTransfersCalls[0]).toMatchObject({
      createdAfter: undefined,
    })

    // Second sync (queued by the recheck timer): the pointer this first
    // sync saved narrows it to the last 72 hours.
    await expect
      .poll(() => wallet.getTransfersCalls.length)
      .toBeGreaterThanOrEqual(2)
    expect(wallet.getTransfersCalls[1]).toMatchObject({
      createdAfter: subHours(testFixedDate, 72),
    })
    expect(errors).toEqual([])
  })

  test("retries reconciliation for a Spark transfer already recorded but never claimed", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    })
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    const transferId = `spark-transfer-${accountId}`
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        spark: {
          accountId,
          amountSats: NonNegativeInteger(1_234),
          exchangeRate: PositiveNumber(1_500_000),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(1_700_000_000_000),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc1invoice"),
            lightningReceiveRequestId: null,
            paymentHash: NonEmptyStringSchema.decode("payment-hash-1"),
            paymentPreimage: null,
          },
        },
      })
    )
    // Simulates a prior sync that recorded the transfer but crashed (or
    // threw) before it got a chance to reconcile it — the existing-row check
    // in `recordTransfer` used to short-circuit on every later sync without
    // ever retrying reconciliation for it.
    await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(1_234),
        currency: "BTC",
        occurredAt: Date.parse("2026-05-27T10:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        spark: {
          sparkTransferId: NonEmptyStringSchema.decode(transferId),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc1invoice"),
            preImage: NonEmptyStringSchema.decode("preimage-1"),
            paymentHash: NonEmptyStringSchema.decode("payment-hash-1"),
          },
        },
      })
    )
    const wallet = new FakeSparkWallet([
      createCompletedTransfer({
        id: transferId,
      }),
    ])
    await using jobRun = testCreateRun({
      deviceId: createRowId<"Device">(),
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      fetch: unimplementedFetch,
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: createFakeWalletFactory(secret, wallet),
        recheckIntervalMs: 10,
      })
    )

    await expect
      .poll(() =>
        evolu.loadQuery(reconciliationClaimsByAccountIdQuery(accountId))
      )
      .toEqual([{ paymentId }])

    // Still exactly one account transaction — the retry reconciled the
    // existing row rather than recording a duplicate.
    expect(
      await evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId))
    ).toHaveLength(1)
    expect(errors).toEqual([])
  })

  test("records a claimed transfer live and removes listeners on dispose", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    const transferId = `spark-transfer-live-${accountId}`
    const wallet = new FakeSparkWallet([
      createCompletedTransfer({
        id: transferId,
        valueSentByWallet: 2100,
        valueReceivedByWallet: 0,
        transferDirection: "OUTGOING",
      }),
    ])
    {
      await using jobRun = testCreateRun({
        deviceId: createRowId<"Device">(),
        console: testCreateConsole(),
        ...evoluTestDeps(evolu),
        ...createTestDateDep(),
        fetch: unimplementedFetch,
        lockManager: createInProcessLockManager(),
        ...testNotificationsDep(),
        onError: (error: unknown) => {
          errors.push(error)
        },
      })
      await using _job = await jobRun.ok(
        createSparkAccountTransactionSyncJob({
          walletFactory: createFakeWalletFactory(secret, wallet),
          recheckIntervalMs: 60_000,
        })
      )

      await expect
        .poll(() => wallet.listenerCount(SparkWalletEvent.TransferClaimed))
        .toBe(1)

      wallet.emit(SparkWalletEvent.TransferClaimed, transferId)

      await expect
        .poll(() =>
          evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId))
        )
        .toMatchObject([
          {
            amount: -2100,
            sparkTransferId: transferId,
            lnInvoice: "lnbc1invoice",
            sparkInvoice: "spark-invoice-1",
            preImage: "preimage-1",
            paymentHash: "payment-hash-1",
          },
        ])
    }

    wallet.emit(SparkWalletEvent.TransferClaimed, transferId)

    expect(wallet.disposals).toHaveLength(1)
    expect(errors).toEqual([])
  })

  test("recovers a transfer claimed before the sync job could subscribe, via the fallback history sync", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    const transferId = `spark-transfer-before-subscribe-${accountId}`
    const wallet = new FakeSparkWallet([
      createCompletedTransfer({
        id: transferId,
      }),
    ])
    await using jobRun = testCreateRun({
      deviceId: createRowId<"Device">(),
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      fetch: unimplementedFetch,
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        // Simulates the shared wallet instance emitting an event before the
        // sync job's init() has had a chance to call subscribe() on it -
        // the event is missed, but the fallback history sync (also run by
        // init()) still records the transfer.
        walletFactory: async (receivedSecret) => {
          const selectedWallet =
            receivedSecret === secret ? wallet : new FakeSparkWallet([])
          selectedWallet.emit(SparkWalletEvent.TransferClaimed, transferId)
          return selectedWallet
        },
        recheckIntervalMs: 60_000,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toMatchObject([
        {
          amount: 1234,
          sparkTransferId: transferId,
        },
      ])
    expect(errors).toEqual([])
  })

  test("retries wallet initialization after a transient failure", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    const transferId = `spark-transfer-retry-${accountId}`
    const wallet = new FakeSparkWallet([
      createCompletedTransfer({
        id: transferId,
      }),
    ])
    let initializationAttempts = 0
    await using jobRun = testCreateRun({
      deviceId: createRowId<"Device">(),
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      fetch: unimplementedFetch,
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: async (receivedSecret) => {
          initializationAttempts += 1
          if (receivedSecret === secret && initializationAttempts === 1) {
            throw new Error("Temporary Spark wallet failure")
          }

          return receivedSecret === secret ? wallet : new FakeSparkWallet([])
        },
        recheckIntervalMs: 10,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toMatchObject([
        {
          sparkTransferId: transferId,
        },
      ])

    expect(initializationAttempts).toBeGreaterThanOrEqual(2)
    expect(errors).toHaveLength(1)
  })

  test("does not retry wallet initialization after disposal", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    let initializationAttempts = 0
    await using jobRun = testCreateRun({
      deviceId: createRowId<"Device">(),
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      fetch: unimplementedFetch,
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    const job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: async () => {
          initializationAttempts += 1
          throw new Error("Temporary Spark wallet failure")
        },
        recheckIntervalMs: 1_000,
      })
    )

    await expect.poll(() => errors).toHaveLength(1)
    await job[Symbol.asyncDispose]()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(initializationAttempts).toBe(1)
  })

  test("records completed Spark transfers without a BOLT11 invoice when Spark invoice exists", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    const transferId = `spark-transfer-without-bolt11-${accountId}`
    const wallet = new FakeSparkWallet([
      createCompletedTransfer({
        id: transferId,
        userRequest: undefined,
      }),
    ])
    await using jobRun = testCreateRun({
      deviceId: createRowId<"Device">(),
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      fetch: unimplementedFetch,
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: createFakeWalletFactory(secret, wallet),
        recheckIntervalMs: 10,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toEqual([
        {
          accountId,
          amount: 1234,
          currency: "BTC",
          occurredAt: new Date("2026-05-27T10:00:00Z").getTime(),
          note: null,
          sparkTransferId: transferId,
          lnInvoice: null,
          sparkInvoice: "spark-invoice-1",
          preImage: null,
          paymentHash: null,
        },
      ])

    expect(errors).toEqual([])
  })

  test("ignores completed Spark transfers without a Spark or BOLT11 invoice", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const errors: unknown[] = []
    const secret = createUniqueSecret()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: {
          secret,
        },
      })
    )
    const transferId = `spark-transfer-without-identifier-${accountId}`
    const wallet = new FakeSparkWallet([
      createCompletedTransfer({
        id: transferId,
        sparkInvoice: undefined,
        userRequest: undefined,
      }),
    ])
    await using jobRun = testCreateRun({
      deviceId: createRowId<"Device">(),
      console: testCreateConsole(),
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      fetch: unimplementedFetch,
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: createFakeWalletFactory(secret, wallet),
        recheckIntervalMs: 10,
      })
    )

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(
      await evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId))
    ).toEqual([])
    expect(errors).toEqual([])
  })

  test("credits a self-pay bill from the memo of the invoice a guest paid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    const { bill, pointer } = await selectSelfPayTestShare(context, reference)
    const rate = {
      currency: "CZK" as const,
      ...signTestSelfPayRate(context.clock.date.now()),
    }
    const invoice = await createGuestLightningInvoice({
      ...createSelfPayLightningRequest({ bill, amount: 45_000, pointer, rate }),
      receiverIdentityPubkey: testSparkIdentity,
      wallet: Promise.resolve({
        createLightningInvoice: async ({ amountSats, memo }) => ({
          invoice: {
            encodedInvoice: createTestLightningInvoice({
              amountSats,
              memo,
              createdAt: rate.validFrom + 60,
            }),
          },
        }),
      }),
    })
    const errors: unknown[] = []
    const wallet = new FakeSparkWallet([
      createSelfPayTransfer(invoice, context.clock.date.now()),
    ])
    await using jobRun = testCreateRun({
      ...context.deps,
      fetch: unimplementedFetch,
      onError: (error: unknown) => {
        errors.push(error)
      },
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: async () => wallet,
        recheckIntervalMs: 10,
      })
    )
    await using run = testCreateRun(context.deps)

    await expect.poll(() => run.orThrow(loadBillStatus(billId))).toBe("closed")
    expect(
      await context.deps.evolu.loadQuery(selfPayPointersByBillIdQuery(billId))
    ).toEqual([{ pointer }])
    expect(errors).toEqual([])
  })

  test("notes a guest's Lightning payment by its invoice's description, not the memo Spark encodes", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    const rate = signTestSelfPayRate(context.clock.date.now())
    const memo = formatSelfPayLightningMemo({
      reference,
      pointer,
      amount: 45_000,
      rate,
    })
    const encodedInvoice = createTestLightningInvoice({
      amountSats: 18_000,
      createdAt: rate.validFrom + 60,
      memo,
    })
    const transfer = createSelfPayTransfer(
      encodedInvoice,
      context.clock.date.now()
    )
    const wallet = new FakeSparkWallet([
      {
        ...transfer,
        userRequest: {
          invoice: {
            encodedInvoice,
            paymentHash: "payment-hash-self-pay",
            memo: btoa(memo),
          },
          paymentPreimage: "preimage-self-pay",
        },
      },
    ])
    await using run = testCreateRun(context.deps)
    await using jobRun = testCreateRun({
      ...context.deps,
      fetch: unimplementedFetch,
      onError: () => undefined,
    })
    await using _job = await jobRun.ok(
      createSparkAccountTransactionSyncJob({
        walletFactory: async () => wallet,
        recheckIntervalMs: 60_000,
      })
    )

    await expect.poll(() => run.orThrow(loadBillStatus(billId))).toBe("closed")
    expect(
      await context.deps.evolu.loadQuery(
        sparkTransactionsByAccountIdQuery(context.sparkAccountId)
      )
    ).toMatchObject([{ note: memo }])
  })

  test("pays a self-pay bill once when Spark reports the transfer in its history and live", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    const rate = signTestSelfPayRate(context.clock.date.now())
    const transfer = createSelfPayTransfer(
      createTestLightningInvoice({
        amountSats: 18_000,
        createdAt: rate.validFrom + 60,
        memo: formatSelfPayLightningMemo({
          reference,
          pointer,
          amount: 45_000,
          rate,
        }),
      }),
      context.clock.date.now()
    )
    const wallet = new FakeSparkWallet([transfer])
    const errors: unknown[] = []
    await using run = testCreateRun(context.deps)
    {
      await using jobRun = testCreateRun({
        ...context.deps,
        fetch: unimplementedFetch,
        onError: (error: unknown) => {
          errors.push(error)
        },
      })
      await using _job = await jobRun.ok(
        createSparkAccountTransactionSyncJob({
          walletFactory: async () => wallet,
          recheckIntervalMs: 60_000,
        })
      )
      await expect
        .poll(() => run.orThrow(loadBillStatus(billId)))
        .toBe("closed")
      await expect
        .poll(() => wallet.listenerCount(SparkWalletEvent.TransferClaimed))
        .toBe(1)

      wallet.emit(SparkWalletEvent.TransferClaimed, transfer.id)

      await expect.poll(() => wallet.getTransferIds).toEqual([transfer.id])
    }

    expect(
      await context.deps.evolu.loadQuery(selfPayPointersByBillIdQuery(billId))
    ).toEqual([{ pointer }])
    expect(
      await context.deps.evolu.loadQuery(
        sparkTransactionsByAccountIdQuery(context.sparkAccountId)
      )
    ).toHaveLength(1)
    expect(errors).toEqual([])
  })
})

describe("spark account transaction sync job, withdrawals", () => {
  const sourcesQuery = (accountId: AccountId) =>
    createQuery((db) =>
      db
        .selectFrom("accountTransactionSource")
        .innerJoin(
          "accountTransaction",
          "accountTransaction.id",
          "accountTransactionSource.accountTransactionId"
        )
        .select(["accountTransactionSource.id"])
        .where("accountTransaction.accountId", "=", accountId)
    )

  const recordLightningWithdrawal = async (
    evolu: EvoluDep["evolu"],
    accountId: AccountId,
    sparkTransferId: string
  ) => {
    const id = createRowId<"Withdrawal">()
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evolu.appOwner }
      evolu.upsert(
        "withdrawal",
        {
          id,
          accountId,
          deviceId: null,
          amountSats: PositiveInteger(1000),
          accountTransactionId: createIdFromString<"AccountTransaction">(
            `accountTransaction:spark:${sparkTransferId}`
          ),
          failedAt: null,
          failureReason: null,
        },
        mutationOptions
      )
      evolu.upsert(
        "withdrawalLightning",
        {
          id,
          lightningAddress: null,
          lnInvoice: NonEmptyStringSchema.decode("lnbc1invoice"),
          sparkTransferId: NonEmptyStringSchema.decode(sparkTransferId),
          maxFeeSats: NonNegativeInteger(13),
        },
        mutationOptions
      )
    })
  }

  const startJob = async (
    transfers: ReadonlyArray<FakeTransfer>,
    {
      recheckIntervalMs = 10,
      withdrawalRecheckIntervalMs,
    }: {
      readonly recheckIntervalMs?: number
      readonly withdrawalRecheckIntervalMs?: number
    } = {}
  ) => {
    const testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const secret = createUniqueSecret()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Spark account"),
        spark: { secret },
      })
    )
    const errors: unknown[] = []
    const wallet = new FakeSparkWallet(transfers)
    const start = async () => {
      const jobRun = testCreateRun({
        deviceId: createRowId<"Device">(),
        console: testCreateConsole(),
        ...evoluTestDeps(evolu),
        ...createTestDateDep(),
        fetch: unimplementedFetch,
        lockManager: createInProcessLockManager(),
        ...testNotificationsDep(),
        onError: (error: unknown) => {
          errors.push(error)
        },
      })
      const job = await jobRun.ok(
        createSparkAccountTransactionSyncJob({
          walletFactory: createFakeWalletFactory(secret, wallet),
          recheckIntervalMs,
          withdrawalRecheckIntervalMs,
        })
      )
      return {
        async [Symbol.asyncDispose]() {
          await job[Symbol.asyncDispose]()
          await jobRun[Symbol.asyncDispose]()
        },
      }
    }
    return { testEvolu, evolu, accountId, errors, start }
  }

  const invoice = createTestInvoice({ hrp: "lnbc10u" })

  const outgoing = (override: Partial<FakeTransfer>): FakeTransfer =>
    createCompletedTransfer({
      transferDirection: "OUTGOING",
      valueSentByWallet: 1013,
      valueReceivedByWallet: 0,
      sparkInvoice: undefined,
      ...override,
    })

  test("records an outgoing Lightning payment with its preimage once, fee included, under its transfer id", async () => {
    const transferId = "0192f7a4-0000-7000-8000-00000000000a"
    const setup = await startJob([
      outgoing({
        id: transferId,
        userRequest: {
          encodedInvoice: invoice,
          paymentPreimage: "preimage-out",
          status: "PREIMAGE_PROVIDED",
        },
      }),
    ])
    await using _ = setup.testEvolu
    const { evolu, accountId, errors } = setup
    await using _job = await setup.start()

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toMatchObject([
        {
          amount: -1013,
          sparkTransferId: transferId,
          lnInvoice: invoice,
          preImage: "preimage-out",
          paymentHash: "11".repeat(32),
        },
      ])
    const [row] = await evolu.loadQuery(
      createQuery((db) =>
        db
          .selectFrom("accountTransaction")
          .select(["id"])
          .where("accountId", "=", accountId)
      )
    )
    expect(row?.id).toBe(
      createIdFromString(`accountTransaction:spark:${transferId}`)
    )
    expect(errors).toEqual([])
  })

  test("skips an outgoing Lightning payment without a preimage", async () => {
    const setup = await startJob([
      outgoing({
        id: "0192f7a4-0000-7000-8000-00000000000b",
        userRequest: { encodedInvoice: invoice, status: "PENDING" },
      }),
    ])
    await using _ = setup.testEvolu
    const { evolu, accountId } = setup
    await using _job = await setup.start()

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(
      await evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId))
    ).toEqual([])
  })

  test("records a bare Spark-fallback withdrawal through the withdrawal check, once", async () => {
    const transferId = "0192f7a4-0000-7000-8000-00000000000c"
    const setup = await startJob([
      outgoing({ id: transferId, userRequest: undefined }),
    ])
    await using _ = setup.testEvolu
    const { evolu, accountId, errors } = setup
    await recordLightningWithdrawal(evolu, accountId, transferId)
    await using _job = await setup.start()

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toMatchObject([
        {
          amount: -1013,
          sparkTransferId: transferId,
          lnInvoice: null,
          sparkInvoice: null,
        },
      ])
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(await evolu.loadQuery(sourcesQuery(accountId))).toHaveLength(1)
    expect(errors).toEqual([])
  })

  test("records a Spark-fallback withdrawal with a Spark invoice once, between the sweep and the check", async () => {
    const transferId = "0192f7a4-0000-7000-8000-00000000000d"
    const setup = await startJob([
      outgoing({
        id: transferId,
        sparkInvoice: "spark-invoice-out",
        userRequest: undefined,
      }),
    ])
    await using _ = setup.testEvolu
    const { evolu, accountId, errors } = setup
    await recordLightningWithdrawal(evolu, accountId, transferId)
    await using _job = await setup.start()

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toMatchObject([
        { sparkTransferId: transferId, sparkInvoice: "spark-invoice-out" },
      ])
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(
      await evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId))
    ).toHaveLength(1)
    expect(await evolu.loadQuery(sourcesQuery(accountId))).toHaveLength(1)
    expect(errors).toEqual([])
  })

  test("records a Lightning withdrawal whose transfer is older than the sweep's window", async () => {
    const transferId = "0192f7a4-0000-7000-8000-00000000000e"
    const setup = await startJob([
      outgoing({
        id: transferId,
        createdTime: subHours(testFixedDate, 24 * 5),
        updatedTime: testFixedDate,
        userRequest: {
          encodedInvoice: invoice,
          paymentPreimage: "late-preimage",
        },
      }),
    ])
    await using _ = setup.testEvolu
    const { evolu, accountId, errors } = setup
    await runMutationWithCompletion((options) =>
      evolu.upsert(
        "sparkAccountSyncPointer",
        { id: accountId, lastSyncedAt: TimestampMs(testFixedDate.getTime()) },
        { ...options, owner: evolu.appOwner }
      )
    )
    await recordLightningWithdrawal(evolu, accountId, transferId)
    await using _job = await setup.start()

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toMatchObject([
        { sparkTransferId: transferId, preImage: "late-preimage" },
      ])
    expect(errors).toEqual([])
  })

  test("checks a withdrawal made after the sweep without waiting for the next one", async () => {
    const transferId = "0192f7a4-0000-7000-8000-00000000000f"
    const setup = await startJob(
      [outgoing({ id: transferId, userRequest: undefined })],
      { recheckIntervalMs: 60_000, withdrawalRecheckIntervalMs: 10 }
    )
    await using _ = setup.testEvolu
    const { evolu, accountId, errors } = setup
    await using _job = await setup.start()
    // Let the first sweep pass and skip the bare transfer.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(
      await evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId))
    ).toEqual([])

    await recordLightningWithdrawal(evolu, accountId, transferId)

    await expect
      .poll(() => evolu.loadQuery(sparkTransactionsByAccountIdQuery(accountId)))
      .toMatchObject([{ sparkTransferId: transferId }])
    expect(errors).toEqual([])
  })
})
