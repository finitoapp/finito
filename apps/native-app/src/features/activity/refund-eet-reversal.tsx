import type { InferRow } from "@evolu/common"
import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { EetDeliveryOutcome } from "@payky/core/integrations/eet/eet-client"
import {
  type DeliverEetReversalError,
  deliverEetReversal,
} from "@payky/core/modules/eet/eet-actions"
import type { eetReversalByRefundIdQuery } from "@payky/core/modules/eet/eet-queries"
import type { EetUnsupportedReason } from "@payky/core/modules/eet/eet-types"
import {
  getEetReversalStartsAt,
  parseEetDateTime,
} from "@payky/core/modules/eet/eet-utils"
import { Integer } from "@payky/core/modules/shared/schema"
import { parseISO } from "date-fns"
import { useAtomValue } from "jotai"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { Button } from "../../components/ui/button.tsx"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"
import {
  EetSaleStatusLabel,
  useEetRecordingDeviceWait,
  useEetSaleStatus,
} from "../shared/eet-sale-status.tsx"

export type RefundEetReversalRow = InferRow<
  ReturnType<typeof eetReversalByRefundIdQuery>
>

const reversalRetryErrorKeys = {
  EetSaleNotFoundError: "paymentDetail.eet.retry.failed",
  EetSaleAlreadyConfirmedError: "paymentDetail.eet.retry.alreadyConfirmed",
  EetSaleUnsupportedError: "paymentDetail.eet.retry.unsupported",
  EetSaleBusyError: "paymentDetail.eet.retry.busy",
  EetSigningCertificateMissingError: "paymentDetail.eet.retry.noCertificate",
  EetReversalWaitingForSaleError: "paymentDetail.eet.reversal.waiting",
} satisfies Record<DeliverEetReversalError["type"], TranslationKey>

const reversalRetryOutcomeKeys = {
  accepted: "paymentDetail.eet.reversal.retry.confirmed",
  verified: "paymentDetail.eet.reversal.retry.confirmed",
  retry: "paymentDetail.eet.retry.pending",
  rejected: "paymentDetail.eet.reversal.retry.rejected",
} satisfies Record<EetDeliveryOutcome["type"], TranslationKey>

const reversalUnsupportedKeys = {
  currency: "paymentDetail.eet.unsupported",
  amount: "paymentDetail.eet.unsupported",
  disabled: "paymentDetail.eet.reversal.unsupported.disabled",
  environment: "paymentDetail.eet.reversal.unsupported.environment",
  taxpayer: "paymentDetail.eet.reversal.unsupported.taxpayer",
} satisfies Record<EetUnsupportedReason, TranslationKey>

/**
 * Web's `RefundEetReversal`: the EET reversal a refund sends (eet/0007), its
 * status, POK and last error, with a manual resend once the sale it negates
 * is confirmed and no other device holds its priority.
 */
export function RefundEetReversal({
  reversal,
}: {
  readonly reversal: RefundEetReversalRow
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const toast = useToast()
  const runToast = useRunToast()
  const [retrying, setRetrying] = useState(false)
  const deviceId = useAtomValue(accountAtom).device.id
  const { status, isOverdue } = useEetSaleStatus(reversal)
  const isWaitingForSale =
    status === "pending" && reversal.saleConfirmedAt === null
  const waitEndsAt = useEetRecordingDeviceWait({
    attempts: reversal,
    recordingDeviceId: reversal.deviceId,
    deviceId,
    startsAt:
      reversal.saleConfirmedAt === null
        ? null
        : getEetReversalStartsAt({
            refundedAt: parseEetDateTime(reversal.saleAt),
            saleConfirmedAt: reversal.saleConfirmedAt,
          }),
  })
  const canRetry =
    !isWaitingForSale &&
    waitEndsAt === null &&
    (status === "pending" || status === "rejected")
  const lastError =
    reversal.pok !== null || reversal.lastErrorMessage === null
      ? null
      : reversal.lastErrorCode === null
        ? reversal.lastErrorMessage
        : t("paymentDetail.eet.errorCode", {
            code: String(reversal.lastErrorCode),
            message: reversal.lastErrorMessage,
          })

  const retry = async () => {
    setRetrying(true)
    await runToast(async (run) => {
      const result = await run(
        deliverEetReversal({ id: reversal.id, deviceId })
      )
      if (!result.ok) return reversalRetryErrorKeys[result.error.type]
      const outcomeKey = reversalRetryOutcomeKeys[result.value.type]
      if (result.value.type === "rejected") return outcomeKey
      toast.success(t(outcomeKey))
      return undefined
    })
    setRetrying(false)
  }

  const note = (text: string, color: "muted-foreground" | "destructive") => (
    <Text fontSize={fontSize.xs} lineHeight={fontSize.xs} color={color}>
      {text}
    </Text>
  )

  return (
    <YStack
      testID="payment-detail-eet-reversal"
      mt={4}
      gap={6}
      p={12}
      rounded={radius.lg}
      bg="muted-20"
    >
      <XStack items="center" justify="space-between" gap={8}>
        <Text
          flex={1}
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          fontWeight={fontWeight.medium}
        >
          {t("paymentDetail.eet.reversal.title", {
            amount: formatMoney(
              { value: Integer(-reversal.amount), currency: reversal.currency },
              locale
            ),
          })}
        </Text>
        <EetSaleStatusLabel sale={reversal} />
      </XStack>
      {isWaitingForSale
        ? note(t("paymentDetail.eet.reversal.waiting"), "muted-foreground")
        : null}
      {waitEndsAt === null
        ? null
        : note(
            t("paymentDetail.eet.reversal.waitingForDevice", {
              time: formatTime(new Date(waitEndsAt), locale),
            }),
            "muted-foreground"
          )}
      {isOverdue ? note(t("paymentDetail.eet.overdue"), "destructive") : null}
      {reversal.unsupportedReason === null
        ? null
        : note(
            t(reversalUnsupportedKeys[reversal.unsupportedReason]),
            "destructive"
          )}
      {reversal.pok === null
        ? null
        : note(
            `${t("paymentDetail.eet.pok")}: ${reversal.pok}`,
            "muted-foreground"
          )}
      {reversal.receivedAt === null
        ? null
        : note(
            `${t("paymentDetail.eet.receivedAt")}: ${formatDateTime(
              parseISO(reversal.receivedAt),
              locale
            )}`,
            "muted-foreground"
          )}
      {lastError === null
        ? null
        : note(
            `${t("paymentDetail.eet.lastError")}: ${lastError}`,
            "muted-foreground"
          )}
      {canRetry ? (
        <XStack>
          <Button
            variant="outline"
            size="sm"
            iconStart={RotateCw}
            label={t("paymentDetail.eet.retry")}
            pending={retrying}
            onPress={() => void retry()}
          />
        </XStack>
      ) : null}
    </YStack>
  )
}
