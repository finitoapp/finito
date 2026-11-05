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
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useEffect, useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { CopyableQrCode } from "../../components/copyable-qr-code.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useQerkoConnectionStatus } from "../../hooks/use-qerko-connection-status.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize } from "../../theme/tokens.ts"

const QERKO_SYNC_POLL_INTERVAL_MS = 5_000

const attemptStateKeys = {
  started: "paymentWait.qerkoPayment.started",
  processing: "paymentWait.qerkoPayment.processing",
  paid: "paymentWait.qerkoPayment.processing",
  failed: "paymentWait.qerkoPayment.failed",
} satisfies Record<QerkoPaymentAttemptState, TranslationKey>

/**
 * A Qerko payment, as web's `QerkoPaymentTab` (qerko/0007): the QR code the
 * customer scans in the Qerko app and what Qerko is doing with it. An attempt
 * still open past the grace period is asked about with `get-payment` from
 * here too, as the sync job does (qerko/0012).
 */
export function QerkoPaymentTab({
  paymentId,
  qrPayload,
  payable,
  connectionDeviceId,
}: {
  readonly paymentId: PaymentId
  readonly qrPayload: string | null
  /** The payment is still waiting for money. */
  readonly payable: boolean
  /** The device serving Qerko payments, `null` when none does. */
  readonly connectionDeviceId: string | null
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const deviceId = useAtomValue(accountAtom).device.id
  const connection = useQerkoConnectionStatus()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const attempts = useEvoluQuery(
    qerkoPaymentAttemptsByPaymentIdQuery(paymentId)
  ).data
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
        nativeConsole.debug("Qerko payment sync failed", result.error)
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
    <YStack gap={12} items="center" w="100%">
      {qrPayload !== null ? (
        <CopyableQrCode value={qrPayload} />
      ) : (
        <XStack items="center" gap={8}>
          <ActivityIndicator />
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("paymentWait.preparing.qerkoPayment")}
          </Text>
        </XStack>
      )}
      {warningKey !== null ? (
        <XStack items="flex-start" gap={6} maxW={288}>
          <Icon icon={TriangleAlert} size={16} color="warning" />
          <Text
            flex={1}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="warning"
          >
            {t(warningKey)}
          </Text>
        </XStack>
      ) : payable && (state === "started" || state === "processing") ? (
        <XStack items="center" gap={6} maxW={288}>
          <ActivityIndicator />
          <Text
            flex={1}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t(attemptStateKeys[state])}
          </Text>
        </XStack>
      ) : payable && state === "failed" ? (
        <Text
          maxW={288}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="warning"
          text="center"
        >
          {t(attemptStateKeys.failed)}
        </Text>
      ) : qrPayload !== null && payable ? (
        <Text
          maxW={288}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
          text="center"
        >
          {t("paymentWait.qerkoPayment.scan")}
        </Text>
      ) : null}
    </YStack>
  )
}
