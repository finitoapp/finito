import { ok, type Run } from "@evolu/common"

import { syncQerkoPaymentAttempt } from "../../modules/payment/payment-qerko-payment-actions.ts"
import { qerkoPaymentSyncGraceMs } from "../../modules/payment/payment-qerko-payment-utils.ts"
import { pendingQerkoPaymentAttemptsQuery } from "../../modules/payment/payment-queries.ts"
import type { QerkoPaymentAttemptId } from "../../modules/payment/payment-types.ts"
import type {
  AppBackgroundJob,
  AppBackgroundJobContext,
} from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"

const QERKO_PAYMENT_SYNC_BASE_DELAY_MS = 5_000
const QERKO_PAYMENT_SYNC_MAX_DELAY_MS = 60_000

/** After the grace period, 5 s doubling up to a minute. */
export const getQerkoPaymentSyncDelayMs = (
  polls: number,
  baseDelayMs = QERKO_PAYMENT_SYNC_BASE_DELAY_MS
): number => Math.min(baseDelayMs * 2 ** polls, QERKO_PAYMENT_SYNC_MAX_DELAY_MS)

interface TrackedAttempt {
  readonly qerkoPaymentId: string
  readonly polls: number
  readonly timer: ReturnType<typeof setTimeout> | null
}

/**
 * Settles Qerko payments whose `paymentClosed` never arrived (qerko/0012):
 * every attempt still in progress is asked about with `get-payment` once the
 * grace period after its start is over, then with backoff until Qerko gives
 * a final state. It runs on every device, since REST needs no websocket, and
 * a lock per attempt keeps the tabs of one browser from asking twice; what it
 * writes goes through `settleQerkoPayment`, which any number of devices can
 * run for the same attempt.
 */
export const createQerkoPaymentSyncJob =
  ({
    graceMs = qerkoPaymentSyncGraceMs,
    retryBaseDelayMs = QERKO_PAYMENT_SYNC_BASE_DELAY_MS,
  }: {
    readonly graceMs?: number
    readonly retryBaseDelayMs?: number
  } = {}): AppBackgroundJob =>
  (run) => {
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("qerko-payment-sync-job"),
    })
    const sync = new QerkoPaymentSync(jobRun, graceMs, retryBaseDelayMs)

    sync.start()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(() => sync.dispose())

    return ok(disposer)
  }

export const startQerkoPaymentSyncJob = createQerkoPaymentSyncJob()

class QerkoPaymentSync {
  private readonly run: Run<AppBackgroundJobContext>
  private readonly graceMs: number
  private readonly baseDelayMs: number
  private readonly tracked = new Map<QerkoPaymentAttemptId, TrackedAttempt>()
  private readonly unsubscribes: ReadonlyArray<() => void>
  private readonly queue = createKeyedTaskQueue<string>({
    onError: (error) => this.run.deps.onError(error),
  })

  constructor(
    run: Run<AppBackgroundJobContext>,
    graceMs: number,
    baseDelayMs: number
  ) {
    this.run = run
    this.graceMs = graceMs
    this.baseDelayMs = baseDelayMs
    const { evolu, connectivity } = run.deps
    this.unsubscribes = [
      evolu.subscribeQuery(pendingQerkoPaymentAttemptsQuery)(() => {
        this.queueReconcile()
      }),
      connectivity.onOnline(() => {
        this.pollAllNow()
      }),
    ]
  }

  start(): void {
    this.queueReconcile()
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

  /** Starts watching new attempts in progress and forgets the ones that ended. */
  private async reconcile(): Promise<void> {
    const attempts = await this.run.deps.evolu.loadQuery(
      pendingQerkoPaymentAttemptsQuery
    )
    if (this.queue.isDisposed) return

    const pendingIds = new Set(attempts.map((attempt) => attempt.id))
    for (const [id, attempt] of this.tracked) {
      if (pendingIds.has(id)) continue
      if (attempt.timer !== null) clearTimeout(attempt.timer)
      this.tracked.delete(id)
    }

    const now = this.run.deps.date.now().getTime()
    for (const attempt of attempts) {
      if (this.tracked.has(attempt.id)) continue
      const graceLeft = Math.max(attempt.startedAt + this.graceMs - now, 0)
      this.schedule(attempt.id, attempt.qerkoPaymentId, 0, graceLeft)
    }
  }

  private schedule(
    id: QerkoPaymentAttemptId,
    qerkoPaymentId: string,
    polls: number,
    delayMs: number
  ): void {
    const timer = setTimeout(() => {
      this.queue.enqueue(id, () => this.poll(id))
    }, delayMs)
    ;(timer as { readonly unref?: () => void }).unref?.()
    this.tracked.set(id, { qerkoPaymentId, polls, timer })
  }

  private pollAllNow(): void {
    for (const [id, attempt] of this.tracked) {
      if (attempt.timer !== null) clearTimeout(attempt.timer)
      this.tracked.set(id, { ...attempt, polls: 0, timer: null })
      this.queue.enqueue(id, () => this.poll(id))
    }
  }

  private async poll(id: QerkoPaymentAttemptId): Promise<void> {
    const attempt = this.tracked.get(id)
    if (attempt === undefined) return
    const { lockManager, deviceId, console } = this.run.deps

    const result = await lockManager.request(
      `qerko-payment-attempt-${id}`,
      { ifAvailable: true },
      async (lock) =>
        lock === null
          ? null
          : await this.run(
              syncQerkoPaymentAttempt({
                qerkoPaymentId: attempt.qerkoPaymentId,
                deviceId,
              })
            )
    )
    if (this.queue.isDisposed || !this.tracked.has(id)) return

    if (result?.ok && (result.value === "paid" || result.value === "failed")) {
      this.tracked.delete(id)
      return
    }
    if (result !== null && !result.ok) {
      console.debug("Qerko payment poll failed.", {
        id,
        reason: result.error.type,
      })
    }
    // Still in progress, offline, Qerko down, another tab asking: it is asked
    // again later.
    this.schedule(
      id,
      attempt.qerkoPaymentId,
      attempt.polls + 1,
      getQerkoPaymentSyncDelayMs(attempt.polls, this.baseDelayMs)
    )
  }
}
