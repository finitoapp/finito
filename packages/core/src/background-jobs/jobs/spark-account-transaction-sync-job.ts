import { err, ok, type Result, type Run, type Task } from "@evolu/common"
import { subHours } from "date-fns"
import { z } from "zod"
import type { DeviceIdDep } from "../../deps.ts"
import {
  activeSparkAccountsQuery,
  sparkAccountSyncPointerByAccountIdQuery,
} from "../../modules/account/account-spark-queries.ts"
import type { AccountId } from "../../modules/account/account-types.ts"
import {
  type CreateAccountTransactionInput,
  computeAccountTransactionRows,
  upsertAccountTransactionRows,
} from "../../modules/account-transaction/account-transaction-actions.ts"
import { accountTransactionSparkByTransferIdQuery } from "../../modules/account-transaction/account-transaction-queries.ts"
import {
  loadAutomaticReconciliation,
  reconcileAccountTransaction,
  SELF_PAY_ARRIVAL_LOCK,
  upsertAutomaticReconciliationRows,
} from "../../modules/reconciliation-claim/reconciliation-claim-actions.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../../modules/shared/evolu-utils.ts"
import type { SparkSecret } from "../../modules/shared/key-derivation.ts"
import { parseLightningInvoice } from "../../modules/shared/lightning-invoice-utils.ts"
import {
  IntegerSchema,
  type NonEmptyString,
  NonEmptyStringSchema,
  TimestampMsSchema,
} from "../../modules/shared/schema.ts"
import { checkPendingWithdrawals } from "../../modules/withdraw/withdraw-check-actions.ts"
import type { SparkWalletTransfer } from "../../spark/spark-wallet.ts"
import {
  createSharedSparkSyncWallet,
  type SharedSparkSyncWallet,
  SPARK_TRANSFER_STATUS_COMPLETED,
} from "../../spark/spark-wallet.ts"
import type { BackgroundJobContext } from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"
import { reconcileAccountSyncSessions } from "../reconcile-account-sync-sessions.ts"

const DEFAULT_RECHECK_INTERVAL_MS = 60_000
// Pending withdrawals are checked on their own, far more often than the
// history sweep: the merchant is usually watching the withdrawal's detail.
// Without pending withdrawals a tick is one local query.
const DEFAULT_WITHDRAWAL_RECHECK_INTERVAL_MS = 10_000
const TRANSFER_PAGE_SIZE = 50
// Bounds the periodic full rescan's `createdAfter` overlap: how long a
// completed transfer's own `createdTime` may lag behind when the SDK first
// reports it as done (an on-chain deposit can sit pending for a while after
// creation before `deposit:confirmed` fires) — see docs/payment-sync.md and
// issues.md #30. The event-driven paths (`transfer:claimed`, and this
// account's own `balance:update`/`deposit:confirmed` triggering a full
// rescan) are the primary way a transfer gets recorded promptly; this window
// is only the safety net's reach when those are missed.
const SPARK_SYNC_LOOKBACK_HOURS = 72
const OUTGOING_TRANSFER_DIRECTION = "OUTGOING"

interface SparkTransfer {
  readonly id: string
  readonly status: SparkWalletTransfer["status"]
  readonly type: SparkWalletTransfer["type"]
  /** What this wallet sent, fee included; `totalValue` is deprecated. */
  readonly valueSentByWallet: number
  readonly valueReceivedByWallet: number
  readonly transferDirection: SparkWalletTransfer["transferDirection"]
  readonly updatedTime: Date | undefined
  readonly createdTime: Date | undefined
  readonly lnInvoice?: string | undefined
  readonly sparkInvoice: string | undefined
  readonly userRequest: unknown
}

type SparkWalletFactory = (
  secret: SparkSecret
) => Promise<SharedSparkSyncWallet>

interface SparkAccountTransactionSyncJobOptions {
  readonly walletFactory?: SparkWalletFactory
  readonly recheckIntervalMs?: number
  readonly withdrawalRecheckIntervalMs?: number
}

interface SparkAccountRow {
  readonly id: AccountId
  readonly secret: SparkSecret
}

interface SparkTransactionDetails {
  readonly lnInvoice: string
  readonly preImage: string
  readonly paymentHash: string | null
}

interface SparkTransactionPayload {
  readonly details: SparkTransactionDetails
  readonly memo: string
}

type RecordTransferResult =
  | "created"
  | "duplicate"
  | "ignored"
  | "lock-unavailable"

type SparkTransactionInput = CreateAccountTransactionInput
type SparkTransactionInputError =
  | "missing-spark-identifier"
  | "missing-preimage"

/**
 * The CLI runs this job too, and has no device: `deviceId` is there only in
 * the app. Without it every withdrawal counts as another device's.
 */
type SparkSyncJobContext = BackgroundJobContext & Partial<DeviceIdDep>

interface RecordTransferOptions {
  /**
   * Record a transfer with neither a Lightning nor a Spark invoice. Only the
   * withdrawal check passes it: it knows the transfer is our own withdrawal
   * paid over a bare Spark fallback (withdraw/0002). The history sweep keeps
   * skipping such transfers.
   */
  readonly allowWithoutInvoice?: boolean
}

export const createSparkAccountTransactionSyncJob =
  ({
    walletFactory = createSharedSparkSyncWallet,
    recheckIntervalMs = DEFAULT_RECHECK_INTERVAL_MS,
    withdrawalRecheckIntervalMs = DEFAULT_WITHDRAWAL_RECHECK_INTERVAL_MS,
  }: SparkAccountTransactionSyncJobOptions = {}): Task<
    AsyncDisposable,
    never,
    SparkSyncJobContext
  > =>
  (run) => {
    // A fresh `run.create()` scope, not the Task's own `run`: that one is
    // disposed the instant this Task function returns, but the sessions
    // below keep composing Tasks (via their stored `run`) for as long as the
    // job itself runs. Explicitly disposed in the returned disposable below —
    // see AGENTS.md and `createRun`'s doc comment on why a detached
    // `createRun` call per transfer (the previous shape here) leaks a root
    // Evolu never gets to dispose.
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("spark-account-transaction-sync-job"),
    })
    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.use(
      createSparkAccountSyncManager({
        run: jobRun,
        recheckIntervalMs,
        withdrawalRecheckIntervalMs,
        walletFactory,
      })
    )

    return ok(disposer)
  }

export const startSparkAccountTransactionSyncJob =
  createSparkAccountTransactionSyncJob()

const createSparkAccountSyncManager = ({
  run,
  recheckIntervalMs,
  withdrawalRecheckIntervalMs,
  walletFactory,
}: {
  readonly run: Run<SparkSyncJobContext>
  readonly recheckIntervalMs: number
  readonly withdrawalRecheckIntervalMs: number
  readonly walletFactory: SparkWalletFactory
}): AsyncDisposable => {
  const sessions = new Map<
    AccountId,
    AsyncDisposable & {
      readonly secret: SparkSecret
      syncHistorySoon: () => void
      checkWithdrawalsSoon: () => void
    }
  >()
  const refreshQueue = createKeyedTaskQueue<"refresh">({
    onError: (error) => run.deps.onError(error),
  })

  const refreshAccounts = async (): Promise<void> => {
    const rows = await run.deps.evolu.loadQuery(activeSparkAccountsQuery)
    const accounts = rows.map(
      (row): SparkAccountRow => ({ id: row.id, secret: row.secret })
    )

    run.deps.console.debug("Refreshing Spark account syncs.", {
      activeAccountCount: accounts.length,
      runningAccountCount: sessions.size,
    })

    await reconcileAccountSyncSessions({
      sessions,
      activeAccounts: accounts,
      getKey: (account) => account.id,
      matches: (session, account) => session.secret === account.secret,
      createSession: (account) =>
        createSparkAccountSyncSession({ account, run, walletFactory }),
      disposeSession: (session) => session[Symbol.asyncDispose](),
      onSessionStopped: (accountId) => {
        run.deps.console.info("Stopped Spark account sync.", { accountId })
      },
      onSessionStarted: (accountId, _account, replacedExistingSync) => {
        run.deps.console.info("Started Spark account sync.", {
          accountId,
          replacedExistingSync,
        })
      },
    })
  }

  const refreshSoon = (): void => {
    refreshQueue.enqueue("refresh", refreshAccounts)
  }

  const unsubscribeAccounts = run.deps.evolu.subscribeQuery(
    activeSparkAccountsQuery
  )(refreshSoon)
  const recheckTimer = setInterval(() => {
    run.deps.console.debug("Queueing Spark history sync for all accounts.", {
      runningAccountCount: sessions.size,
    })

    for (const session of sessions.values()) {
      session.syncHistorySoon()
    }
  }, recheckIntervalMs)
  ;(recheckTimer as { readonly unref?: () => void }).unref?.()
  const withdrawalRecheckTimer = setInterval(() => {
    for (const session of sessions.values()) {
      session.checkWithdrawalsSoon()
    }
  }, withdrawalRecheckIntervalMs)
  ;(withdrawalRecheckTimer as { readonly unref?: () => void }).unref?.()

  run.deps.console.info("Started Spark account transaction sync job.")
  refreshSoon()

  return {
    async [Symbol.asyncDispose]() {
      if (refreshQueue.isDisposed) return

      clearInterval(recheckTimer)
      clearInterval(withdrawalRecheckTimer)
      unsubscribeAccounts()
      await refreshQueue[Symbol.asyncDispose]()

      for (const session of sessions.values()) {
        await session[Symbol.asyncDispose]()
      }
      sessions.clear()
      run.deps.console.info("Stopped Spark account transaction sync job.")
    },
  }
}

const createSparkAccountSyncSession = ({
  account,
  run,
  walletFactory,
}: {
  readonly account: SparkAccountRow
  readonly run: Run<SparkSyncJobContext>
  readonly walletFactory: SparkWalletFactory
}): AsyncDisposable & {
  readonly secret: SparkSecret
  syncHistorySoon: () => void
  checkWithdrawalsSoon: () => void
} => {
  let wallet: SharedSparkSyncWallet | undefined
  let unsubscribeEvents: (() => void) | undefined
  let disposed = false
  let isInitializing = false
  let pendingHistorySync = false
  const pendingTransferIds = new Set<string>()
  const queue = createKeyedTaskQueue<
    "history" | "withdrawals" | `transfer:${string}`
  >({
    onError: (error) => run.deps.onError(error),
  })

  const bufferTransferSync = (transferId: string, message: string): void => {
    pendingTransferIds.add(transferId)
    run.deps.console.debug(message, {
      accountId: account.id,
      pendingTransferCount: pendingTransferIds.size,
      sparkTransferId: transferId,
    })
  }

  const queueTransferSync = (transferId: string): void => {
    queue.enqueue(`transfer:${transferId}`, () => syncTransferById(transferId))
  }

  const queueHistorySync = (): void => {
    queue.enqueue("history", syncHistory)
  }

  const bufferHistorySync = (message: string): void => {
    pendingHistorySync = true
    run.deps.console.debug(message, {
      accountId: account.id,
    })
  }

  const recordTransfer = async (
    transfer: SparkTransfer,
    { allowWithoutInvoice = false }: RecordTransferOptions = {}
  ): Promise<RecordTransferResult> => {
    if (!shouldRecordTransfer(transfer)) {
      run.deps.console.debug("Ignored Spark transfer.", {
        accountId: account.id,
        sparkTransferId: transfer.id,
        transfer,
      })
      return "ignored"
    }

    return await run.deps.lockManager.request(
      `spark-transfer-${transfer.id}`,
      { ifAvailable: true },
      async (lock) => {
        if (lock === null) {
          run.deps.console.debug("Skipped locked Spark transfer.", {
            accountId: account.id,
            sparkTransferId: transfer.id,
          })
          return "lock-unavailable"
        }

        const sparkTransferId = NonEmptyStringSchema.decode(transfer.id)
        const existing = await run.deps.evolu.loadQuery(
          accountTransactionSparkByTransferIdQuery(sparkTransferId)
        )
        const existingAccountTransactionId = existing[0]?.id
        if (existingAccountTransactionId !== undefined) {
          run.deps.console.debug("Skipped already recorded Spark transfer.", {
            accountId: account.id,
            sparkTransferId,
            existingCount: existing.length,
          })
          // A prior sync may have recorded the transaction but crashed or
          // failed before claiming it, and this transfer would then never be
          // downloaded again to give reconciliation another chance —
          // `reconcileAccountTransaction` itself is the guard against
          // redoing work for one already claimed.
          await run.ok(
            reconcileAccountTransaction(existingAccountTransactionId)
          )
          return "duplicate"
        }

        const input = createSparkTransactionInput(
          account.id,
          sparkTransferId,
          transfer,
          run.deps.date.now(),
          allowWithoutInvoice
        )
        if (!input.ok) {
          run.deps.console.debug("Ignored incomplete Spark transfer.", {
            accountId: account.id,
            reason: input.error,
            sparkTransferId,
          })
          return "ignored"
        }

        const accountTransaction = computeAccountTransactionRows(
          input.value,
          run.deps.date.now()
        )
        const reconciliation = await run.deps.lockManager.request(
          SELF_PAY_ARRIVAL_LOCK,
          async () => {
            const loaded = await run.ok(
              loadAutomaticReconciliation(input.value, accountTransaction)
            )
            await runMutationWithCompletion((options) => {
              upsertAccountTransactionRows(run.deps.evolu, accountTransaction, {
                ...options,
                owner: run.deps.evoluOwner,
              })
              if (loaded !== null) {
                upsertAutomaticReconciliationRows(run.deps.evolu, loaded, {
                  ...options,
                  owner: run.deps.evoluOwner,
                })
              }
            })
            return loaded
          }
        )
        const accountTransactionId = accountTransaction.id
        const paymentId = reconciliation?.claim.paymentId ?? null
        run.deps.console.info("Created Spark account transaction.", {
          accountId: account.id,
          accountTransactionId,
          amount: getTransferAmount(transfer),
          paymentId,
          sparkTransferId,
        })
        return "created"
      }
    )
  }

  /**
   * Settles our pending Lightning withdrawals and records the ones that
   * finished, outside the sweep's window (withdraw/0002, withdraw/0003).
   */
  const checkWithdrawals = async (
    currentWallet: SharedSparkSyncWallet
  ): Promise<void> => {
    const toRecord = await run.ok(
      checkPendingWithdrawals({
        accountId: account.id,
        deviceId: run.deps.deviceId ?? null,
        getTransfer: (id) => currentWallet.getTransfer(id),
      })
    )
    for (const transfer of toRecord) {
      await recordTransfer(transfer, { allowWithoutInvoice: true })
    }
  }

  const syncTransferById = async (transferId: string): Promise<void> => {
    const currentWallet = wallet
    if (currentWallet === undefined) {
      bufferTransferSync(
        transferId,
        "Buffered Spark transfer sync before wallet init."
      )
      return
    }

    const transfer = await currentWallet.getTransfer(transferId)
    if (transfer === undefined) {
      run.deps.console.warn(
        "Spark transfer event referenced an unavailable transfer.",
        {
          accountId: account.id,
          sparkTransferId: transferId,
        }
      )
      queueHistorySync()
      return
    }

    await recordTransfer(transfer)
  }

  const syncHistory = async (): Promise<void> => {
    const currentWallet = wallet
    if (currentWallet === undefined) {
      bufferHistorySync("Buffered Spark history sync before wallet init.")
      return
    }

    // Captured before the sweep, like FIO's sync period `to`: the pointer
    // advances with the clock regardless of what (if anything) this sweep
    // finds, so a quiet account still narrows next time's window instead of
    // getting stuck re-scanning from its first ever sync forever.
    const startedAt = run.deps.date.now()
    const pointer = await run.deps.evolu.loadQuery(
      sparkAccountSyncPointerByAccountIdQuery(account.id)
    )
    const createdAfter =
      pointer[0] === undefined
        ? undefined
        : subHours(pointer[0].lastSyncedAt, SPARK_SYNC_LOOKBACK_HOURS)

    let offset = 0
    let pageCount = 0
    let transferCount = 0
    const results: Record<RecordTransferResult, number> = {
      created: 0,
      duplicate: 0,
      ignored: 0,
      "lock-unavailable": 0,
    }

    run.deps.console.info("Started Spark transfer history sync.", {
      accountId: account.id,
      createdAfter: createdAfter ?? null,
      pageSize: TRANSFER_PAGE_SIZE,
    })

    while (!queue.isDisposed) {
      const page = await currentWallet.getTransfers(
        TRANSFER_PAGE_SIZE,
        offset,
        createdAfter
      )
      pageCount += 1
      transferCount += page.transfers.length

      run.deps.console.debug("Fetched Spark transfer page.", {
        accountId: account.id,
        offset,
        nextOffset: page.offset,
        transferCount: page.transfers.length,
      })

      for (const transfer of page.transfers) {
        const result = await recordTransfer(transfer)
        results[result] += 1
      }

      if (page.transfers.length === 0 || page.offset <= offset) break
      offset = page.offset
    }

    // Only once the sweep actually finished — a sweep cut short by disposal
    // covered less than `[createdAfter, now)` and must not claim it did.
    if (!queue.isDisposed) {
      await saveSparkSyncPointer(run, account.id, startedAt)
      await checkWithdrawals(currentWallet)
    }

    run.deps.console.info("Finished Spark transfer history sync.", {
      accountId: account.id,
      pageCount,
      transferCount,
      createdCount: results.created,
      duplicateCount: results.duplicate,
      ignoredCount: results.ignored,
      lockUnavailableCount: results["lock-unavailable"],
      disposed: queue.isDisposed,
    })
  }

  const syncTransferSoon = (transferId: string): void => {
    if (wallet === undefined) {
      bufferTransferSync(
        transferId,
        "Buffered Spark transfer event before wallet init."
      )
      return
    }

    queueTransferSync(transferId)
  }

  const syncHistorySoon = (): void => {
    if (wallet === undefined) {
      bufferHistorySync("Buffered Spark history event before wallet init.")
      initializeSoon()
      return
    }

    queueHistorySync()
  }

  const flushBufferedWork = (): void => {
    for (const transferId of pendingTransferIds) {
      queueTransferSync(transferId)
    }
    pendingTransferIds.clear()

    if (pendingHistorySync) {
      pendingHistorySync = false
      queueHistorySync()
    }
  }

  const init = async (): Promise<void> => {
    if (disposed || wallet !== undefined || isInitializing) {
      return
    }

    run.deps.console.debug("Initializing Spark wallet.", {
      accountId: account.id,
    })

    isInitializing = true

    try {
      const createdWallet = await walletFactory(account.secret)

      if (disposed) {
        await createdWallet[Symbol.asyncDispose]()
        return
      }

      wallet = createdWallet
      // Uses the SDK's SparkWalletEvent string values directly (verified
      // against its declaration) instead of importing the enum, so this
      // module doesn't pull the Spark SDK's runtime code into the app's
      // main bundle — see spark-wallet.ts's sparkWalletPool comment.
      unsubscribeEvents = createdWallet.subscribe({
        "transfer:claimed": (transferId) => {
          run.deps.console.debug("Received Spark transfer claimed event.", {
            accountId: account.id,
            sparkTransferId: transferId,
          })
          syncTransferSoon(transferId)
        },
        "balance:update": () => {
          run.deps.console.debug("Received Spark balance update event.", {
            accountId: account.id,
          })
          syncHistorySoon()
        },
        "deposit:confirmed": () => {
          run.deps.console.debug("Received Spark deposit confirmed event.", {
            accountId: account.id,
          })
          syncHistorySoon()
        },
      })
      run.deps.console.info("Initialized Spark wallet.", {
        accountId: account.id,
      })
      flushBufferedWork()
      syncHistorySoon()
    } finally {
      isInitializing = false
    }
  }

  const initializeSoon = (): void => {
    void init().catch((error: unknown) => {
      run.deps.onError(error)
    })
  }

  initializeSoon()

  return {
    get secret() {
      return account.secret
    },
    syncHistorySoon,
    checkWithdrawalsSoon: () => {
      const currentWallet = wallet
      if (currentWallet === undefined || queue.isDisposed) return
      queue.enqueue("withdrawals", () => checkWithdrawals(currentWallet))
    },
    async [Symbol.asyncDispose]() {
      if (disposed) return

      disposed = true
      pendingTransferIds.clear()
      pendingHistorySync = false

      unsubscribeEvents?.()
      unsubscribeEvents = undefined

      await queue[Symbol.asyncDispose]()

      const walletToCleanup = wallet
      wallet = undefined

      if (walletToCleanup === undefined) {
        run.deps.console.debug("Disposed Spark account sync before init.", {
          accountId: account.id,
        })
        return
      }

      try {
        await walletToCleanup[Symbol.asyncDispose]()
      } catch (error) {
        run.deps.onError(error)
      }
    },
  }
}

const saveSparkSyncPointer = async (
  run: Run<SparkSyncJobContext>,
  accountId: AccountId,
  lastSyncedAt: Date
): Promise<void> => {
  await runMutationWithCompletion((options) =>
    run.deps.evolu.upsert(
      "sparkAccountSyncPointer",
      removeUndefinedValues({
        id: accountId,
        lastSyncedAt: TimestampMsSchema.decode(lastSyncedAt.getTime()),
      }),
      { ...options, owner: run.deps.evoluOwner }
    )
  )
  run.deps.console.debug("Saved Spark sync pointer.", {
    accountId,
    lastSyncedAt,
  })
}

const createSparkTransactionInput = (
  accountId: AccountId,
  sparkTransferId: NonEmptyString,
  transfer: SparkTransfer,
  now: Date,
  allowWithoutInvoice: boolean
): Result<SparkTransactionInput, SparkTransactionInputError> => {
  // An outgoing Lightning payment over the SSP counts only once its preimage
  // proves it went through; until then it is skipped, and a later pass
  // records it (withdraw/0002).
  const send = LightningSendRequestSchema.safeParse(transfer.userRequest)
  if (send.success && !send.data.paymentPreimage) {
    return err("missing-preimage")
  }
  const payload = send.success
    ? getLightningSendPayload(send.data)
    : getSparkTransactionPayload(transfer.userRequest)
  const lnInvoice = nullableNonEmptyString(
    transfer.lnInvoice ?? payload?.details.lnInvoice
  )
  const sparkInvoice = nullableNonEmptyString(transfer.sparkInvoice)
  if (lnInvoice === null && sparkInvoice === null && !allowWithoutInvoice) {
    return err("missing-spark-identifier")
  }

  return ok({
    accountId,
    amount: IntegerSchema.decode(getTransferAmount(transfer)),
    currency: "BTC" as const,
    occurredAt: TimestampMsSchema.decode(getTransferOccurredAt(transfer, now)),
    note: getTransferNote(payload?.memo ?? ""),
    internalTransferGroupId: null,
    source: {
      deviceId: null,
      source: "auto" as const,
    },
    spark: {
      sparkTransferId,
      lightning:
        lnInvoice === null
          ? undefined
          : {
              lnInvoice,
              preImage: nullableNonEmptyString(payload?.details.preImage),
              paymentHash: nullableNonEmptyString(
                payload?.details.paymentHash ?? undefined
              ),
            },
      sparkInvoice:
        sparkInvoice === null
          ? undefined
          : {
              sparkInvoice,
            },
    },
  })
}

const shouldRecordTransfer = (transfer: SparkTransfer): boolean =>
  transfer.status === SPARK_TRANSFER_STATUS_COMPLETED &&
  getTransferAmount(transfer) !== 0

const getTransferAmount = (transfer: SparkTransfer): number =>
  transfer.transferDirection === OUTGOING_TRANSFER_DIRECTION
    ? -transfer.valueSentByWallet
    : transfer.valueReceivedByWallet

const getTransferOccurredAt = (transfer: SparkTransfer, now: Date): number =>
  (transfer.updatedTime ?? transfer.createdTime ?? now).getTime()

const getTransferNote = (memo: string): NonEmptyString | null =>
  memo === "" ? null : NonEmptyStringSchema.decode(memo)

const nullableNonEmptyString = (
  value: string | undefined
): NonEmptyString | null =>
  value === undefined ? null : NonEmptyStringSchema.decode(value)

const UserRequestSchema = z.looseObject({
  paymentPreimage: z.string().min(1),
  invoice: z.object({
    encodedInvoice: z.string().min(1),
    paymentHash: z.string().min(1),
    memo: z.string().nullable().optional(),
  }),
})

const getSparkTransactionPayload = (
  userRequest: unknown
): SparkTransactionPayload | null => {
  const result = UserRequestSchema.safeParse(userRequest)
  if (!result.success) return null

  const { paymentPreimage, invoice } = result.data
  return {
    details: {
      lnInvoice: invoice.encodedInvoice,
      preImage: paymentPreimage,
      paymentHash: invoice.paymentHash,
    },
    memo: invoice.memo ?? "",
  }
}

// The SDK's `LightningSendRequest`: the invoice sits at the top level, unlike
// a receive request's `invoice.encodedInvoice`.
const LightningSendRequestSchema = z.looseObject({
  encodedInvoice: z.string().min(1),
  paymentPreimage: z.string().nullish(),
})

const getLightningSendPayload = ({
  encodedInvoice,
  paymentPreimage,
}: z.output<typeof LightningSendRequestSchema>): SparkTransactionPayload => {
  const invoice = parseLightningInvoice(encodedInvoice)
  return {
    details: {
      lnInvoice: encodedInvoice,
      preImage: paymentPreimage ?? "",
      paymentHash: invoice.ok ? invoice.value.paymentHash : null,
    },
    memo: "",
  }
}
