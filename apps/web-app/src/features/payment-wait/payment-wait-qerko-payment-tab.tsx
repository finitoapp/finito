import { useTimestamp } from "@dedalik/use-react"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { syncQerkoPaymentAttempt } from "@payky/core/modules/payment/payment-qerko-payment-actions"
import {
  deriveQerkoPaymentAttemptState,
  type QerkoPaymentAttemptState,
  qerkoPaymentSyncGraceMs,
} from "@payky/core/modules/payment/payment-qerko-payment-utils"
import { qerkoPaymentAttemptsByPaymentIdQuery } from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react"
import { accountAtom } from "@/atoms/account.ts"
import { QrPaymentRequest } from "@/features/payment-wait/payment-wait-qr-request.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useQerkoConnectionStatus } from "@/hooks/use-qerko-connection-status.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const QERKO_SYNC_POLL_INTERVAL_MS = 5_000

const attemptStateKeys = {
  started: "paymentWait.qerkoPayment.started",
  processing: "paymentWait.qerkoPayment.processing",
  paid: "paymentWait.qerkoPayment.processing",
  failed: "paymentWait.qerkoPayment.failed",
} satisfies Record<QerkoPaymentAttemptState, TranslationKey>

/**
 * A Qerko payment (qerko/0007): the QR code the customer scans in the Qerko
 * app, and what Qerko is doing with it. The payment turns paid through its
 * claim, written by whichever device holds the connection, so this screen
 * needs no polling of its own — except when `paymentClosed` is late: an
 * attempt open past the grace period is asked about with `get-payment` from
 * here too, as the sync job does (qerko/0012).
 */
export function QerkoPaymentTab({
  paymentId,
  qrPayload,
  payable,
  connectionDeviceId,
  preparingMessageKey,
  hasTip,
}: {
  readonly paymentId: PaymentId
  readonly qrPayload: string | null
  /** The payment is still waiting for money. */
  readonly payable: boolean
  /** The device serving Qerko payments, `null` when none does. */
  readonly connectionDeviceId: string | null
  readonly preparingMessageKey: TranslationKey | null
  /**
   * The payment carries a tip entered here. Qerko's bill leaves it out and
   * the customer picks the tip in Qerko, which replaces it once paid.
   */
  readonly hasTip: boolean
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const console = useConsole()
  const deviceId = useAtomValue(accountAtom).device.id
  const connection = useQerkoConnectionStatus()
  const now = useTimestamp({ interval: 1000 })
  const { data: attempts } = useEvoluQuery(
    qerkoPaymentAttemptsByPaymentIdQuery(paymentId)
  )
  const attempt = attempts.at(-1)
  const state =
    attempt === undefined ? null : deriveQerkoPaymentAttemptState(attempt)
  const late =
    attempt !== undefined &&
    attempt.closedAt === null &&
    now - attempt.startedAt > qerkoPaymentSyncGraceMs

  useQuery({
    queryKey: ["qerkoPaymentSync", attempt?.qerkoPaymentId],
    enabled: payable && late,
    refetchInterval: QERKO_SYNC_POLL_INTERVAL_MS,
    queryFn: async () => {
      if (attempt === undefined) return null
      await using run = appRun()
      const result = await run(
        syncQerkoPaymentAttempt({
          qerkoPaymentId: attempt.qerkoPaymentId,
          deviceId,
        })
      )
      if (!result.ok) {
        // Offline or Qerko down: the next poll, or the job, asks again.
        console.debug("Qerko payment sync failed", result.error)
        return null
      }
      return result.value
    },
  })

  const warningKey: TranslationKey | null = !payable
    ? null
    : connectionDeviceId === null
      ? "paymentWait.qerkoPayment.noDevice"
      : connectionDeviceId === deviceId && connection.type !== "connected"
        ? "paymentWait.qerkoPayment.disconnected"
        : null

  return (
    <>
      <QrPaymentRequest
        qrPayload={qrPayload}
        preparingMessageKey={preparingMessageKey}
      />
      {warningKey !== null ? (
        <p
          className="flex max-w-72 items-start gap-1.5 text-balance text-sm text-warning"
          role="status"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {t(warningKey)}
        </p>
      ) : payable && (state === "started" || state === "processing") ? (
        <p
          className="flex max-w-72 items-center gap-1.5 text-balance text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircleIcon className="size-4 shrink-0 animate-spin" />
          {t(attemptStateKeys[state])}
        </p>
      ) : payable && state === "failed" ? (
        <p className="max-w-72 text-balance text-sm text-warning" role="status">
          {t(attemptStateKeys.failed)}
        </p>
      ) : qrPayload !== null && payable ? (
        <p className="max-w-72 text-balance text-sm text-muted-foreground">
          {t("paymentWait.qerkoPayment.scan")}
        </p>
      ) : null}
      {payable && hasTip ? (
        <p className="max-w-72 text-balance text-sm text-muted-foreground">
          {t("paymentWait.qerkoPayment.tipChosenInQerko")}
        </p>
      ) : null}
    </>
  )
}
