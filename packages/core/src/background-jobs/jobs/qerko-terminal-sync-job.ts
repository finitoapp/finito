import { ok, type Run } from "@evolu/common"
import { syncQerkoTerminalPayment } from "../../modules/payment/payment-qerko-actions.ts"
import { pendingQerkoTerminalPaymentsQuery } from "../../modules/payment/payment-queries.ts"
import type { PaymentId } from "../../modules/payment/payment-types.ts"
import {
  repairQerkoTerminalTipRefunds,
  syncQerkoTerminalRefund,
} from "../../modules/refund/refund-qerko-actions.ts"
import {
  pendingQerkoTerminalRefundAttemptsQuery,
  qerkoTerminalRefundsMissingTipQuery,
} from "../../modules/refund/refund-queries.ts"
import type { RefundId } from "../../modules/refund/refund-types.ts"
import type {
  AppBackgroundJob,
  AppBackgroundJobContext,
} from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"

const QERKO_POLL_BASE_DELAY_MS = 1_000
const QERKO_POLL_MAX_DELAY_MS = 60_000

/** First poll after `baseDelayMs`, then doubling up to a minute. */
export const getQerkoPollDelayMs = (
  polls: number,
  baseDelayMs = QERKO_POLL_BASE_DELAY_MS
): number => Math.min(baseDelayMs * 2 ** polls, QERKO_POLL_MAX_DELAY_MS)

/** What is being polled: a payment's attempt or a refund to the card. */
type Subject =
  | { readonly kind: "payment"; readonly id: PaymentId }
  | { readonly kind: "refund"; readonly id: RefundId }

const subjectKey = ({ kind, id }: Subject): string => `${kind}:${id}`

interface TrackedAttempt {
  readonly subject: Subject
  readonly attemptId: string
  readonly polls: number
  readonly timer: ReturnType<typeof setTimeout> | null
}

/**
 * Settles Qerko card payments and refunds nobody is watching (qerko/0005): a
 * pending attempt is polled until Qerko gives a final answer, whichever device is
 * open — the one that started it may be closed, offline or gone. It is driven
 * by the pending attempts themselves, so it needs no schedule of its own, and
 * every write `syncQerkoTerminalPayment` makes is idempotent, which is what
 * lets this run beside the payment screen's own polling and on several
 * devices at once.
 *
 * It also writes the tip an older version left out when it settled a refund
 * of a whole payment (`repairQerkoTerminalTipRefunds`), whenever one shows
 * up, since that settlement may happen on any device.
 */
export const createQerkoTerminalSyncJob =
  ({
    retryBaseDelayMs = QERKO_POLL_BASE_DELAY_MS,
  }: {
    readonly retryBaseDelayMs?: number
  } = {}): AppBackgroundJob =>
  (run) => {
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("qerko-terminal-sync-job"),
    })
    const sync = new QerkoTerminalSync(jobRun, retryBaseDelayMs)

    sync.start()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(() => sync.dispose())

    return ok(disposer)
  }

export const startQerkoTerminalSyncJob = createQerkoTerminalSyncJob()

class QerkoTerminalSync {
  private readonly run: Run<AppBackgroundJobContext>
  private readonly baseDelayMs: number
  private readonly tracked = new Map<string, TrackedAttempt>()
  private readonly unsubscribes: ReadonlyArray<() => void>
  private readonly queue = createKeyedTaskQueue<string>({
    onError: (error) => this.run.deps.onError(error),
  })

  constructor(run: Run<AppBackgroundJobContext>, baseDelayMs: number) {
    this.run = run
    this.baseDelayMs = baseDelayMs
    const { evolu, connectivity } = run.deps
    this.unsubscribes = [
      evolu.subscribeQuery(pendingQerkoTerminalPaymentsQuery)(() => {
        this.queueReconcile()
      }),
      evolu.subscribeQuery(pendingQerkoTerminalRefundAttemptsQuery)(() => {
        this.queueReconcile()
      }),
      evolu.subscribeQuery(qerkoTerminalRefundsMissingTipQuery)(() => {
        this.queueTipRepair()
      }),
      connectivity.onOnline(() => {
        this.pollAllNow()
      }),
    ]
  }

  start(): void {
    this.queueReconcile()
    this.queueTipRepair()
  }

  async dispose(): Promise<void> {
    if (this.queue.isDisposed) return

    for (const unsubscribe of this.unsubscribes) unsubscribe()
    for (const { timer } of this.tracked.values()) {
      if (timer !== null) clearTimeout(timer)
    }
    this.tracked.clear()
    await this.queue[Symbol.asyncDispose]()
  }

  private queueReconcile(): void {
    this.queue.enqueue("reconcile", () => this.reconcile())
  }

  private queueTipRepair(): void {
    this.queue.enqueue("tipRepair", async () => {
      const repaired = await this.run.ok(repairQerkoTerminalTipRefunds())
      if (repaired > 0) {
        this.run.deps.console.info("Wrote the tip of a whole Qerko refund.", {
          repaired,
        })
      }
    })
  }

  /** Starts watching new pending attempts and forgets the ones that ended. */
  private async reconcile(): Promise<void> {
    const { evolu } = this.run.deps
    const [payments, refunds] = await Promise.all([
      evolu.loadQuery(pendingQerkoTerminalPaymentsQuery),
      evolu.loadQuery(pendingQerkoTerminalRefundAttemptsQuery),
    ])
    if (this.queue.isDisposed) return

    const pending: ReadonlyArray<{
      readonly subject: Subject
      readonly attemptId: string
    }> = [
      ...payments.map((row) => ({
        subject: { kind: "payment", id: row.id } satisfies Subject,
        attemptId: row.pendingTransactionId,
      })),
      ...refunds.map((row) => ({
        subject: { kind: "refund", id: row.id } satisfies Subject,
        attemptId: row.transactionId,
      })),
    ]
    const pendingKeys = new Set(
      pending.map(({ subject }) => subjectKey(subject))
    )
    for (const [key, attempt] of this.tracked) {
      if (pendingKeys.has(key)) continue
      if (attempt.timer !== null) clearTimeout(attempt.timer)
      this.tracked.delete(key)
    }

    for (const { subject, attemptId } of pending) {
      const attempt = this.tracked.get(subjectKey(subject))
      if (attempt?.attemptId === attemptId) continue
      // A new attempt on a subject already watched starts over.
      if (attempt !== undefined && attempt.timer !== null) {
        clearTimeout(attempt.timer)
      }
      this.track(subject, attemptId, 0)
    }
  }

  private track(subject: Subject, attemptId: string, polls: number): void {
    const key = subjectKey(subject)
    const timer = setTimeout(
      () => {
        this.queue.enqueue(key, () => this.poll(key))
      },
      getQerkoPollDelayMs(polls, this.baseDelayMs)
    )
    ;(timer as { readonly unref?: () => void }).unref?.()
    this.tracked.set(key, { subject, attemptId, polls, timer })
  }

  private pollAllNow(): void {
    for (const [key, attempt] of this.tracked) {
      if (attempt.timer !== null) clearTimeout(attempt.timer)
      this.tracked.set(key, { ...attempt, polls: 0, timer: null })
      this.queue.enqueue(key, () => this.poll(key))
    }
  }

  private async poll(key: string): Promise<void> {
    const attempt = this.tracked.get(key)
    if (attempt === undefined) return
    const { subject } = attempt

    const result =
      subject.kind === "payment"
        ? await this.run(
            syncQerkoTerminalPayment({
              paymentId: subject.id,
              deviceId: this.run.deps.deviceId,
            })
          )
        : await this.run(syncQerkoTerminalRefund(subject.id))
    if (this.queue.isDisposed) return

    if (!result.ok) {
      this.run.deps.console.debug("Qerko poll failed.", {
        key,
        reason: result.error.type,
      })
      // A definite answer ended the attempt; anything else (offline, Qerko
      // down) is tried again later.
      if (
        result.error.type === "QerkoTerminalPaymentFailed" ||
        result.error.type === "QerkoTerminalRefundFailed" ||
        result.error.type === "PaymentNotFound"
      ) {
        this.tracked.delete(key)
        return
      }
      this.track(subject, attempt.attemptId, attempt.polls + 1)
      return
    }

    if (result.value.status === "pending") {
      this.track(subject, attempt.attemptId, attempt.polls + 1)
      return
    }

    this.run.deps.console.info("Settled a Qerko attempt.", {
      key,
      status: result.value.status,
    })
    this.tracked.delete(key)
  }
}
