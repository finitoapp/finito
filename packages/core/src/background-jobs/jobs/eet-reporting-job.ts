import { type LockManagerDep, ok, type Run, type Task } from "@evolu/common"
import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import type {
  EetApiDep,
  EetDeliveryOutcome,
} from "../../integrations/eet/eet-client.ts"
import type { DeviceId } from "../../modules/device/device-types.ts"
import {
  createEetExtraSale,
  createEetReversal,
  createEetSale,
  type DeliverEetReversalError,
  deliverEetReversal,
  deliverEetSale,
} from "../../modules/eet/eet-actions.ts"
import {
  eetCreationTriggerQuery,
  eetExtraClaimsQuery,
  eetPaymentsToReportQuery,
  eetRefundsToReverseQuery,
  eetReversalsToDeliverQuery,
  eetSalesToDeliverQuery,
} from "../../modules/eet/eet-queries.ts"
import type { EetReversalId, EetSaleId } from "../../modules/eet/eet-types.ts"
import {
  calculateEetSettlementValue,
  deriveDueEetExtraSale,
  EET_PRIORITY_PERIOD_MS,
  getEetReversalStartsAt,
  parseEetDateTime,
} from "../../modules/eet/eet-utils.ts"
import type { PaymentId } from "../../modules/payment/payment-types.ts"
import type { EvoluDep } from "../../modules/shared/evolu-deps.ts"
import { NonNegativeInteger } from "../../modules/shared/schema.ts"
import type {
  AppBackgroundJob,
  AppBackgroundJobContext,
} from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"

type EetRecordId = EetSaleId | EetReversalId

type EetDelivery = Task<
  EetDeliveryOutcome,
  DeliverEetReversalError,
  EvoluDep & EvoluOwnerDep & DateDep & EetApiDep & LockManagerDep
>

const EET_RETRY_BASE_DELAY_MS = 30_000
/**
 * How often the job looks for what is due without being told: the one
 * change `eetCreationTriggerQuery` cannot see, an update synced with an
 * older timestamp than the newest row, waits at most this long (eet/0013).
 */
const EET_CREATION_RECHECK_MS = 5 * 60 * 1000
const EET_RETRY_MAX_DELAY_MS = 15 * 60 * 1000

export const getEetRetryDelayMs = (
  failedAttempts: number,
  baseDelayMs = EET_RETRY_BASE_DELAY_MS
): number =>
  Math.min(baseDelayMs * 2 ** (failedAttempts - 1), EET_RETRY_MAX_DELAY_MS)

interface SaleBackoff {
  readonly failedAttempts: number
  readonly timer: ReturnType<typeof setTimeout> | null
}

export const createEetReportingJob =
  ({
    retryBaseDelayMs = EET_RETRY_BASE_DELAY_MS,
    priorityPeriodMs = EET_PRIORITY_PERIOD_MS,
    creationRecheckMs = EET_CREATION_RECHECK_MS,
  }: {
    readonly retryBaseDelayMs?: number
    readonly priorityPeriodMs?: number
    readonly creationRecheckMs?: number
  } = {}): AppBackgroundJob =>
  (run) => {
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("eet-reporting-job"),
    })
    const reporting = new EetReporting(jobRun, {
      retryBaseDelayMs,
      priorityPeriodMs,
      creationRecheckMs,
    })

    reporting.start()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(() => reporting.dispose())

    return ok(disposer)
  }

export const startEetReportingJob = createEetReportingJob()

class EetReporting {
  private readonly run: Run<AppBackgroundJobContext>
  private readonly retryBaseDelayMs: number
  private readonly priorityPeriodMs: number
  private readonly backoffs = new Map<EetRecordId, SaleBackoff>()
  private takeover: {
    readonly at: number
    readonly timer: ReturnType<typeof setTimeout>
  } | null = null
  private onlineCount = 0
  private readonly unsubscribes: ReadonlyArray<() => void>
  private readonly creationRecheck: ReturnType<typeof setInterval>
  private readonly queue = createKeyedTaskQueue<"create" | "deliver">({
    onError: (error) => this.run.deps.onError(error),
  })

  constructor(
    run: Run<AppBackgroundJobContext>,
    {
      retryBaseDelayMs,
      priorityPeriodMs,
      creationRecheckMs,
    }: {
      readonly retryBaseDelayMs: number
      readonly priorityPeriodMs: number
      readonly creationRecheckMs: number
    }
  ) {
    this.run = run
    this.retryBaseDelayMs = retryBaseDelayMs
    this.priorityPeriodMs = priorityPeriodMs
    const { evolu, connectivity } = run.deps
    // What is due to be created is read only when the trigger moves, not
    // kept subscribed: those queries read every claim since EET was enabled
    // (eet/0013). What is due to be delivered stays subscribed, as it is
    // read from the sales and reversals alone.
    this.unsubscribes = [
      evolu.subscribeQuery(eetCreationTriggerQuery)(() => {
        this.queueCreation()
      }),
      evolu.subscribeQuery(eetSalesToDeliverQuery)(() => {
        this.queueDelivery()
      }),
      evolu.subscribeQuery(eetReversalsToDeliverQuery)(() => {
        this.queueDelivery()
      }),
      connectivity.onOnline(() => {
        this.retryNow()
      }),
    ]
    this.creationRecheck = setInterval(() => {
      this.queueCreation()
    }, creationRecheckMs)
    ;(this.creationRecheck as { readonly unref?: () => void }).unref?.()
  }

  start(): void {
    this.queueCreation()
    this.queueDelivery()
  }

  async dispose(): Promise<void> {
    if (this.queue.isDisposed) return

    for (const unsubscribe of this.unsubscribes) unsubscribe()
    clearInterval(this.creationRecheck)
    for (const { timer } of this.backoffs.values()) {
      if (timer !== null) clearTimeout(timer)
    }
    this.backoffs.clear()
    if (this.takeover !== null) clearTimeout(this.takeover.timer)
    this.takeover = null
    await this.queue[Symbol.asyncDispose]()
  }

  private queueCreation(): void {
    this.queue.enqueue("create", () => this.createSales())
  }

  private queueDelivery(): void {
    this.queue.enqueue("deliver", () => this.deliverSales())
  }

  private retryNow(): void {
    this.onlineCount += 1
    for (const [saleId, backoff] of this.backoffs) {
      if (backoff.timer !== null) clearTimeout(backoff.timer)
      this.backoffs.set(saleId, { ...backoff, timer: null })
    }
    this.queueDelivery()
  }

  private async createSales(): Promise<void> {
    const { evolu } = this.run.deps
    const payments = await evolu.loadQuery(eetPaymentsToReportQuery)

    for (const payment of payments) {
      if (this.queue.isDisposed) return
      const recordingDeviceId =
        payment.firstClaimDeviceId ?? payment.paymentDeviceId
      if (recordingDeviceId === null) continue
      const takeoverAt = this.getTakeoverAt(
        recordingDeviceId,
        payment.firstClaimedAt
      )
      if (takeoverAt !== null) {
        this.wakeUpAt(takeoverAt)
        continue
      }
      const saleId = await this.run.ok(
        createEetSale({
          payment: {
            ...payment,
            firstSettlementValue: calculateEetSettlementValue({
              settlement: {
                accountTransactionId: payment.firstClaimTransactionId,
                amount: payment.firstClaimAmount,
                currency: payment.firstClaimCurrency,
                paymentAmount: payment.amount,
                paymentCurrency: payment.currency,
                paymentAmountSats: payment.paymentAmountSats,
              },
              amount: payment.amount,
            }),
          },
          deviceId: recordingDeviceId,
        })
      )
      if (saleId !== null) {
        this.run.deps.console.info("Created EET sale.", {
          paymentId: payment.id,
          saleId,
        })
      }
    }

    const refunds = await evolu.loadQuery(eetRefundsToReverseQuery)
    const paymentsWithUnreportedExtra = await this.createExtraSales()
    if (paymentsWithUnreportedExtra === null) return

    for (const refund of refunds) {
      if (this.queue.isDisposed) return
      if (paymentsWithUnreportedExtra.has(refund.paymentId)) continue
      if (refund.deviceId !== this.run.deps.deviceId) {
        if (refund.saleConfirmedAt === null) continue
        const takeoverAt = this.getTakeoverAt(
          refund.deviceId,
          getEetReversalStartsAt({
            refundedAt: refund.refundedAt,
            saleConfirmedAt: refund.saleConfirmedAt,
          })
        )
        if (takeoverAt !== null) {
          this.wakeUpAt(takeoverAt)
          continue
        }
      }
      const reversalId = await this.run.ok(
        createEetReversal({ refund, deviceId: refund.deviceId })
      )
      if (reversalId !== null) {
        this.run.deps.console.info("Created EET reversal.", {
          refundId: refund.id,
          reversalId,
        })
      }
    }
  }

  private async createExtraSales(): Promise<ReadonlySet<PaymentId> | null> {
    const claims = await this.run.deps.evolu.loadQuery(eetExtraClaimsQuery)
    const unreported = new Set<PaymentId>()

    for (const paymentClaims of Map.groupBy(
      claims,
      ({ paymentId }) => paymentId
    ).values()) {
      if (this.queue.isDisposed) return null
      const [payment] = paymentClaims
      if (payment === undefined) continue
      const due = deriveDueEetExtraSale({
        claims: paymentClaims,
        amount: payment.paymentAmount,
        tipAmount: NonNegativeInteger(payment.paymentTipAmount ?? 0),
        tipOwner: payment.tipOwner,
        saleSettlementIds: payment.sales.map(
          ({ accountTransactionId }) => accountTransactionId
        ),
        enabledAt: payment.enabledAt,
        reportedExtra: NonNegativeInteger(payment.reportedExtra ?? 0),
      })
      if (due === null) continue

      unreported.add(payment.paymentId)
      const recordingDeviceId = due.claim.deviceId ?? payment.paymentDeviceId
      if (recordingDeviceId === null) continue
      const takeoverAt = this.getTakeoverAt(
        recordingDeviceId,
        due.claim.claimedAt
      )
      if (takeoverAt !== null) {
        this.wakeUpAt(takeoverAt)
        continue
      }
      const saleId = await this.run.ok(
        createEetExtraSale({
          payment: {
            id: payment.paymentId,
            billId: payment.billId,
            currency: payment.paymentCurrency,
          },
          due,
          deviceId: recordingDeviceId,
        })
      )
      if (saleId === null) continue
      unreported.delete(payment.paymentId)
      this.run.deps.console.info("Created EET extra sale.", {
        paymentId: payment.paymentId,
        saleId,
      })
    }

    return unreported
  }

  private async deliverSales(): Promise<void> {
    const { evolu, deviceId } = this.run.deps
    const sales = await evolu.loadQuery(eetSalesToDeliverQuery)
    for (const sale of sales) {
      if (this.queue.isDisposed) return
      const takeoverAt = this.getTakeoverAt(
        sale.deviceId,
        parseEetDateTime(sale.saleAt)
      )
      if (takeoverAt !== null) {
        this.wakeUpAt(takeoverAt)
        continue
      }
      await this.attemptDelivery(
        sale.id,
        deliverEetSale({ id: sale.id, deviceId })
      )
    }

    const reversals = await evolu.loadQuery(eetReversalsToDeliverQuery)
    for (const reversal of reversals) {
      if (this.queue.isDisposed) return
      const takeoverAt = this.getTakeoverAt(
        reversal.deviceId,
        getEetReversalStartsAt({
          refundedAt: parseEetDateTime(reversal.saleAt),
          saleConfirmedAt: reversal.saleConfirmedAt,
        })
      )
      if (takeoverAt !== null) {
        this.wakeUpAt(takeoverAt)
        continue
      }
      await this.attemptDelivery(
        reversal.id,
        deliverEetReversal({ id: reversal.id, deviceId })
      )
    }
  }

  private getTakeoverAt(
    recordingDeviceId: DeviceId,
    startsAt: number
  ): number | null {
    if (recordingDeviceId === this.run.deps.deviceId) return null
    const takeoverAt = startsAt + this.priorityPeriodMs
    return this.run.deps.date.now().getTime() >= takeoverAt ? null : takeoverAt
  }

  private wakeUpAt(at: number): void {
    if (this.takeover !== null) {
      if (this.takeover.at <= at) return
      clearTimeout(this.takeover.timer)
    }
    const timer = setTimeout(
      () => {
        this.takeover = null
        this.queueCreation()
        this.queueDelivery()
      },
      Math.max(0, at - this.run.deps.date.now().getTime())
    )
    ;(timer as { readonly unref?: () => void }).unref?.()
    this.takeover = { at, timer }
  }

  private async attemptDelivery(
    id: EetRecordId,
    delivery: EetDelivery
  ): Promise<void> {
    if (this.isWaitingForRetry(id)) return

    const onlineCountBefore = this.onlineCount
    const result = await this.run(delivery)
    if (!result.ok) {
      this.run.deps.console.debug("Skipped EET delivery.", {
        id,
        reason: result.error.type,
      })
      return
    }

    const cameOnlineDuringAttempt = this.onlineCount !== onlineCountBefore
    if (result.value.type === "retry") {
      if (!cameOnlineDuringAttempt) this.scheduleRetry(id)
    } else {
      this.backoffs.delete(id)
    }
    this.run.deps.console.info("Attempted EET delivery.", {
      id,
      outcome: result.value.type,
    })
  }

  private isWaitingForRetry(saleId: EetRecordId): boolean {
    return (this.backoffs.get(saleId)?.timer ?? null) !== null
  }

  private scheduleRetry(saleId: EetRecordId): void {
    const failedAttempts = (this.backoffs.get(saleId)?.failedAttempts ?? 0) + 1
    const delayMs = getEetRetryDelayMs(failedAttempts, this.retryBaseDelayMs)
    const timer = setTimeout(() => {
      const backoff = this.backoffs.get(saleId)
      if (backoff !== undefined) {
        this.backoffs.set(saleId, { ...backoff, timer: null })
      }
      this.queueDelivery()
    }, delayMs)
    ;(timer as { readonly unref?: () => void }).unref?.()
    this.backoffs.set(saleId, { failedAttempts, timer })
  }
}
