import { err, ok, type Run } from "@evolu/common"

import {
  getQerkoSocketUrl,
  type QerkoEnvironment,
} from "../../integrations/qerko/qerko-client.ts"
import type { QerkoConnectionStatus } from "../../integrations/qerko/qerko-connection-status.ts"
import {
  createQerkoRpcSession,
  type QerkoPosHandlers,
  type QerkoRpcSession,
  type QerkoRpcTiming,
  type QerkoSessionEnd,
  type QerkoSessionState,
  qerkoRpcError,
  qerkoRpcTiming,
} from "../../integrations/qerko/qerko-rpc.ts"
import { qerkoPaymentAccountQuery } from "../../modules/account/account-queries.ts"
import type {
  ResolveQerkoBillError,
  StartQerkoPaymentError,
} from "../../modules/payment/payment-errors.ts"
import {
  processQerkoPayment,
  resolveQerkoBill,
  settleQerkoPayment,
  startQerkoPayment,
} from "../../modules/payment/payment-qerko-payment-actions.ts"
import { qerkoPluginQuery } from "../../modules/qerko-plugin/qerko-plugin-queries.ts"
import type {
  AppBackgroundJob,
  AppBackgroundJobContext,
} from "../background-job-types.ts"

const QERKO_RECONNECT_BASE_DELAY_MS = 1_000
const QERKO_RECONNECT_MAX_DELAY_MS = 60_000

/** One lock across the tabs of this browser: one of them holds the websocket. */
export const qerkoPaymentConnectionLockName = "qerko-payment-connection"

/** First retry after `baseDelayMs`, then doubling up to a minute. */
export const getQerkoReconnectDelayMs = (
  failures: number,
  baseDelayMs = QERKO_RECONNECT_BASE_DELAY_MS
): number => Math.min(baseDelayMs * 2 ** failures, QERKO_RECONNECT_MAX_DELAY_MS)

/** What a connection is opened with; a change of any of it reconnects. */
interface QerkoConnectionConfig {
  readonly key: string
  readonly apiKey: string
  readonly environment: QerkoEnvironment
}

const errorCodes = {
  QerkoBillNotFound: "BILL_NOT_FOUND",
  QerkoBillClosed: "BILL_CLOSED",
  QerkoBillLocked: "BILL_LOCKED",
  QerkoInvalidData: "INVALID_DATA",
} satisfies Record<
  ResolveQerkoBillError["type"] | StartQerkoPaymentError["type"],
  string
>

const toRpcError = (
  error: ResolveQerkoBillError | StartQerkoPaymentError
): ReturnType<typeof qerkoRpcError> =>
  qerkoRpcError(
    errorCodes[error.type],
    error.type === "QerkoInvalidData" ? `Invalid ${error.reason}` : error.type
  )

/**
 * Holds Qerko's POS websocket on the one device of the account chosen to
 * serve Qerko payments (qerko/0011), and answers Qerko's calls for every
 * device's payments. It follows the account and the pairing: it connects when
 * this device is chosen and the `standard` role is paired, and disconnects
 * when another device is chosen — which is how a takeover reaches the device
 * that held it. Across the tabs of one browser a lock keeps it to one.
 *
 * A dropped line reconnects with backoff, at once when the device comes back
 * online, and after the pause Qerko asks for. A connection Qerko handed to
 * another (`stolen`) or whose key it refused (`unauthorized`) stays down
 * until this device is chosen again or paired again.
 */
export const createQerkoPaymentConnectionJob =
  ({
    retryBaseDelayMs = QERKO_RECONNECT_BASE_DELAY_MS,
    timing = qerkoRpcTiming,
  }: {
    readonly retryBaseDelayMs?: number
    readonly timing?: QerkoRpcTiming
  } = {}): AppBackgroundJob =>
  (run) => {
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("qerko-payment-connection-job"),
    })
    const connection = new QerkoPaymentConnection(
      jobRun,
      retryBaseDelayMs,
      timing
    )

    connection.start()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(() => connection.dispose())

    return ok(disposer)
  }

export const startQerkoPaymentConnectionJob = createQerkoPaymentConnectionJob()

class QerkoPaymentConnection {
  private readonly run: Run<AppBackgroundJobContext>
  private readonly baseDelayMs: number
  private readonly timing: QerkoRpcTiming
  private readonly unsubscribes: ReadonlyArray<() => void>
  private config: QerkoConnectionConfig | null = null
  /** The config a stolen or refused connection stopped at. */
  private stoppedAt: string | null = null
  private holding: Promise<void> | null = null
  private disposed = false
  private wakeUp: (() => void) | null = null

  constructor(
    run: Run<AppBackgroundJobContext>,
    baseDelayMs: number,
    timing: QerkoRpcTiming
  ) {
    this.run = run
    this.baseDelayMs = baseDelayMs
    this.timing = timing
    const { evolu, connectivity, qerkoConnectionStatus } = run.deps
    this.unsubscribes = [
      evolu.subscribeQuery(qerkoPaymentAccountQuery)(() => {
        void this.reconcile()
      }),
      evolu.subscribeQuery(qerkoPluginQuery("standard"))(() => {
        void this.reconcile()
      }),
      connectivity.onOnline(() => this.wake()),
      qerkoConnectionStatus.onResume(() => {
        this.stoppedAt = null
        this.wake()
      }),
    ]
  }

  start(): void {
    void this.reconcile()
  }

  async dispose(): Promise<void> {
    this.disposed = true
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    this.wake()
    await this.holding
  }

  private wake(): void {
    const wakeUp = this.wakeUp
    this.wakeUp = null
    wakeUp?.()
  }

  /** Resolves on the next `wake`, or after `ms` when given. */
  private sleep(ms?: number): Promise<void> {
    return new Promise((resolve) => {
      const timer =
        ms === undefined
          ? null
          : setTimeout(() => {
              if (this.wakeUp === done) this.wakeUp = null
              resolve()
            }, ms)
      const done = () => {
        if (timer !== null) clearTimeout(timer)
        resolve()
      }
      // One sleeper at a time: the loop below is the only one.
      this.wakeUp = done
    })
  }

  private async reconcile(): Promise<void> {
    const { evolu, deviceId } = this.run.deps
    const [[account], [plugin]] = await Promise.all([
      evolu.loadQuery(qerkoPaymentAccountQuery),
      evolu.loadQuery(qerkoPluginQuery("standard")),
    ])
    if (this.disposed) return

    const chosen =
      account !== undefined &&
      account.isDeleted !== 1 &&
      account.connectionDeviceId === deviceId
    const next: QerkoConnectionConfig | null =
      chosen && plugin !== undefined && plugin.restaurantId !== null
        ? {
            // The location too: pairing another one moves the key there.
            key: `${plugin.environment}:${plugin.apiKey}:${plugin.restaurantId}`,
            apiKey: plugin.apiKey,
            environment: plugin.environment,
          }
        : null

    const changed = next?.key !== this.config?.key
    this.config = next
    // A new key is a new pairing, and losing the choice ends the takeover: a
    // refused or stolen connection waits for either, or for `resume`.
    if (next === null || this.stoppedAt !== next.key) this.stoppedAt = null
    if (changed) this.wake()
    if (next !== null && this.holding === null) {
      this.holding = this.hold().finally(() => {
        this.holding = null
        // The lock may have been granted after the config went away and back.
        if (!this.disposed && this.config !== null) void this.reconcile()
      })
    }
  }

  /** Waits for the lock, then keeps a connection up for as long as wanted. */
  private async hold(): Promise<void> {
    await this.run.deps.lockManager.request(
      qerkoPaymentConnectionLockName,
      async () => {
        let failures = 0
        while (!this.disposed && this.config !== null) {
          const config = this.config
          if (this.stoppedAt === config.key) {
            await this.sleep()
            continue
          }

          const ended = await this.connect(config)
          if (ended === null) continue // the config changed or the job stopped

          if (ended.type === "stolen" || ended.type === "unauthorized") {
            this.stoppedAt = config.key
            this.setStatus({ type: ended.type })
            continue
          }

          const delayMs =
            ended.delayMs ??
            getQerkoReconnectDelayMs(failures, this.baseDelayMs)
          failures = ended.delayMs === null ? failures + 1 : 0
          this.setStatus({
            type: "reconnecting",
            retryAt: this.run.deps.date.now().getTime() + delayMs,
          })
          await this.sleep(delayMs)
        }
        this.setStatus({ type: "idle" })
      }
    )
  }

  private setStatus(status: QerkoConnectionStatus): void {
    if (!this.disposed) this.run.deps.qerkoConnectionStatus.set(status)
  }

  /**
   * One session: resolves with how it ended, or `null` when it was closed
   * because the config changed or the job stopped.
   */
  private connect(
    config: QerkoConnectionConfig
  ): Promise<QerkoSessionEnd | null> {
    const { qerkoApi, qerkoSocket, console, onError } = this.run.deps
    return new Promise((resolve) => {
      let session: QerkoRpcSession | null = null
      const onState = (state: QerkoSessionState) => {
        if (state.type === "connecting" || state.type === "connected") {
          this.setStatus({ type: state.type })
          return
        }
        this.wakeUp = null
        resolve(state)
      }
      session = createQerkoRpcSession({
        qerkoSocket,
        console,
        url: getQerkoSocketUrl(qerkoApi, config.environment),
        posId: qerkoApi.posId,
        apiKey: config.apiKey,
        handlers: this.handlers(),
        onState,
        onError,
        timing: this.timing,
      })
      // Woken while connected: the config changed, the job stopped, or the
      // device came online (a no-op while the session is up).
      const watch = (): void => {
        this.wakeUp = () => {
          if (this.disposed || this.config?.key !== config.key) {
            session?.close()
            resolve(null)
            return
          }
          watch()
        }
      }
      watch()
    })
  }

  private handlers(): QerkoPosHandlers {
    const { deviceId } = this.run.deps
    return {
      searchBills: async (qrIdentifier) => {
        const bill = await this.run(resolveQerkoBill(qrIdentifier))
        if (bill.ok) return ok([bill.value])
        return bill.error.type === "QerkoBillNotFound"
          ? ok([])
          : err(toRpcError(bill.error))
      },
      getBill: async (idBill) => {
        const bill = await this.run(resolveQerkoBill(idBill))
        return bill.ok ? bill : err(toRpcError(bill.error))
      },
      paymentStart: async (payment) => {
        const started = await this.run(startQerkoPayment(payment))
        return started.ok ? ok(null) : err(toRpcError(started.error))
      },
      paymentProcessed: async (idPayment) => {
        const receipt = await this.run(processQerkoPayment(idPayment))
        return receipt.ok
          ? receipt
          : err(qerkoRpcError("INVALID_DATA", "Unknown payment"))
      },
      paymentClosed: async (idPayment, state) => {
        const settled = await this.run(
          settleQerkoPayment({ qerkoPaymentId: idPayment, state, deviceId })
        )
        // Received either way: what could not be recorded now, the sync job
        // settles from get-payment (qerko/0012).
        if (!settled.ok) {
          this.run.deps.console.warn("Could not settle a Qerko payment.", {
            idPayment,
            state,
            reason: settled.error.type,
          })
        }
        return ok(null)
      },
    }
  }
}
