import type { InferRow } from "@evolu/common"
import { formatDateTime } from "@payky/app-shared/format-date"
import {
  isQerkoKeyRejected,
  qerkoStepKeys,
} from "@payky/app-shared/qerko-terminal-flow"
import {
  refundMethodLabelKey,
  returnedOverpaymentLabel,
} from "@payky/app-shared/refund-form"
import { eetReversalsByPaymentIdQuery } from "@payky/core/modules/eet/eet-queries"
import {
  dismissQerkoTerminalRefundAttempt,
  syncQerkoTerminalRefund,
} from "@payky/core/modules/refund/refund-qerko-actions"
import type {
  cardSwitchioRefundAttemptsByPaymentIdQuery,
  qerkoTerminalRefundAttemptsByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "@payky/core/modules/refund/refund-queries"
import {
  dismissCardSwitchioRefundAttempt,
  resolveCardSwitchioRefundAttempt,
} from "@payky/core/modules/refund/refund-switchio-actions"
import type { RefundId } from "@payky/core/modules/refund/refund-types"
import {
  isTipRefund,
  returnedOverpaymentOf,
  sumGoodsRefundAmounts,
  sumRefundAmounts,
  sumReturnedOverpayment,
} from "@payky/core/modules/refund/refund-utils"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import { useAtomValue } from "jotai"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import Undo2 from "lucide-react-native/icons/undo-2"
import { useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
import { VerticalNavRow } from "../../components/vertical-nav.tsx"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { isSwitchioRefundInFlight } from "../../platform/switchio.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { EetSaleStatusLabel } from "../shared/eet-sale-status.tsx"
import { RefundBadge } from "../shared/refund-badge.tsx"
import type { RefundEetReversalRow } from "./refund-eet-reversal.tsx"
import {
  type RefundablePayment,
  usePaymentRefundState,
} from "./use-payment-refund-state.ts"

/**
 * Native counterpart of web's `PaymentDetailRefunds`: the refunds already
 * recorded (refund/0001), each a link to its detail, the refunds to the card
 * a terminal has not settled, and one button that opens the refund screen
 * (`RefundPage`) whenever anything is left to refund and no refund to the
 * card is running. What is left comes from `usePaymentRefundState`
 * (refund/0002, 0004, 0005).
 */
export function PaymentRefunds({
  payment,
  excess,
  isPaid,
  paymentMethodKinds,
}: {
  readonly payment: RefundablePayment
  readonly excess: NonNegativeInteger
  readonly isPaid: boolean
  /** The kinds of the transactions that settled the payment. */
  readonly paymentMethodKinds: ReadonlyArray<string>
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const {
    refunds,
    availability,
    qerkoAttempts,
    switchioAttempts,
    options,
    cardAttemptRunning,
  } = usePaymentRefundState({ payment, excess, isPaid, paymentMethodKinds })
  const reversals = useEvoluQuery(eetReversalsByPaymentIdQuery(payment.id)).data
  const money = (value: NonNegativeInteger) =>
    formatMoney({ value, currency: payment.currency }, locale)
  const canStartRefund = options.choices.length > 0 && !cardAttemptRunning

  if (
    refunds.length === 0 &&
    qerkoAttempts.length === 0 &&
    switchioAttempts.length === 0 &&
    !canStartRefund
  ) {
    return null
  }

  const refundActions =
    qerkoAttempts.length > 0 ||
    switchioAttempts.length > 0 ||
    canStartRefund ? (
      <YStack gap={8}>
        {qerkoAttempts.map((attempt) => (
          <QerkoRefundAttempt
            key={attempt.id}
            attempt={attempt}
            formatMinor={money}
          />
        ))}
        {switchioAttempts.map((attempt) => (
          <SwitchioRefundAttempt
            key={attempt.id}
            attempt={attempt}
            formatMinor={money}
          />
        ))}
        {canStartRefund ? (
          <Button
            variant="outline"
            h={48}
            iconStart={Undo2}
            label={t("paymentDetail.refunds.action")}
            onPress={() =>
              router.push({
                pathname: "/activity/[paymentId]/refund",
                params: { paymentId: payment.id },
              })
            }
          />
        ) : null}
      </YStack>
    ) : null

  if (refunds.length === 0) return refundActions

  return (
    <Card testID="payment-detail-refunds">
      <CardHeader>
        <CardTitle>{t("paymentDetail.refunds.title")}</CardTitle>
        <CardAction>
          <RefundBadge
            summary={{
              refundedAmount: sumGoodsRefundAmounts(refunds),
              returnedAmount: sumRefundAmounts(refunds),
              returnedOverpaymentAmount: sumReturnedOverpayment(refunds),
              refundableAmount: availability.refundableAmount,
              currency: payment.currency,
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent gap={12}>
        <YStack>
          {refunds.map((refund) => (
            <RefundRow
              key={refund.id}
              refund={refund}
              reversal={reversals.find(
                (reversal) => reversal.refundId === refund.id
              )}
            />
          ))}
        </YStack>
        {refundActions}
      </CardContent>
    </Card>
  )
}

type PaymentRefundRow = InferRow<ReturnType<typeof refundsByPaymentIdQuery>>

/**
 * One recorded refund, a link to its detail (`RefundDetailPage`): the amount,
 * "Tip ·", the method and the time, and only the status of its EET reversal,
 * so one pending, refused or overdue shows without opening it. The items and
 * the reversal's POK, errors and resend live on the detail.
 */
function RefundRow({
  refund,
  reversal,
}: {
  readonly refund: PaymentRefundRow
  readonly reversal: RefundEetReversalRow | undefined
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const amount = formatMoney(
    { value: refund.amount, currency: refund.currency },
    locale
  )
  const returned =
    returnedOverpaymentOf(refund) > 0
      ? `${returnedOverpaymentLabel({
          refund,
          t,
          format: (value) =>
            formatMoney({ value, currency: refund.currency }, locale),
        })} · `
      : ""
  const details = `${isTipRefund(refund) ? `${t("paymentDetail.refunds.tip")} · ` : ""}${returned}${t(refundMethodLabelKey[refund.method])} · ${formatDateTime(new Date(refund.refundedAt), locale)}`
  return (
    <YStack testID="payment-detail-refund" mx={-12}>
      <VerticalNavRow
        item={{
          kind: "link",
          href: {
            pathname: "/activity/[paymentId]/refunds/[refundId]",
            params: { paymentId: refund.paymentId, refundId: refund.id },
          },
          accessibilityLabel: `${amount}, ${details}`,
          label: (
            <YStack gap={4} items="flex-start">
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight={fontWeight.semibold}
              >
                {amount}
              </Text>
              <Text
                fontSize={fontSize.xs}
                lineHeight={fontSize.xs}
                color="muted-foreground"
              >
                {details}
              </Text>
              {reversal === undefined ? null : (
                <EetSaleStatusLabel sale={reversal} />
              )}
            </YStack>
          ),
        }}
      />
    </YStack>
  )
}

/**
 * Polls a refund to the card on the Qerko terminal while it is pending,
 * settling it once the terminal answered. The attempt's card here and the
 * refund screen's progress share the one query, so they poll once between
 * them.
 */
export function useQerkoRefundPoll({
  attemptId,
  pending,
}: {
  readonly attemptId: RefundId | undefined
  readonly pending: boolean
}) {
  const appRun = useAppRun()
  const poll = useQuery({
    queryKey: ["qerko", "refund-sync", attemptId],
    enabled: pending && attemptId !== undefined,
    refetchInterval: 1000,
    queryFn: async () => {
      if (attemptId === undefined) return { status: "idle" as const }
      await using run = appRun()
      const result = await run(syncQerkoTerminalRefund(attemptId))
      return result.ok
        ? result.value
        : {
            status: "error" as const,
            keyRejected: isQerkoKeyRejected(result.error),
          }
    },
  })
  return {
    progress: poll.data,
    step: poll.data?.status === "pending" ? poll.data.step : "connecting",
    // A refused key leaves the attempt pending; pairing anew lets the poll go on.
    keyRejected: poll.data?.status === "error" && poll.data.keyRejected,
  }
}

/** Web's link to pair the terminal anew after Qerko refused its key. */
export function QerkoKeyRejected() {
  const { t } = useTranslation()
  return (
    <>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.medium}
        color="destructive"
      >
        {t("paymentWait.qerko.error.keyRejected")}
      </Text>
      <Button
        variant="link"
        label={t("paymentWait.qerko.error.keyRejected.link")}
        onPress={() => {
          router.push("/settings/payment-accounts/qerko-terminal")
        }}
      />
    </>
  )
}

type QerkoRefundAttemptRow = InferRow<
  ReturnType<typeof qerkoTerminalRefundAttemptsByPaymentIdQuery>
>

/** Web's `QerkoRefundAttempt`: a card refund the terminal has not settled. */
function QerkoRefundAttempt({
  attempt,
  formatMinor,
}: {
  readonly attempt: QerkoRefundAttemptRow
  readonly formatMinor: (value: NonNegativeInteger) => string
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const isPending = attempt.status === "pending"
  const { step, keyRejected } = useQerkoRefundPoll({
    attemptId: attempt.id,
    pending: isPending,
  })

  const dismiss = () =>
    runToast(async (run) => {
      await run.ok(dismissQerkoTerminalRefundAttempt(attempt.id))
    })

  return (
    <YStack
      testID="payment-detail-qerko-refund"
      gap={8}
      bg="neutral-soft"
      rounded={8}
      px={12}
      py={8}
    >
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {t("refund.qerko.pending")} ·{" "}
        {formatMinor(
          // The tip a whole-payment refund returns beside the goods.
          NonNegativeInteger(attempt.amount + (attempt.tipAmount ?? 0))
        )}
      </Text>
      {isPending ? (
        <XStack items="center" gap={8}>
          <ActivityIndicator />
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t(qerkoStepKeys[step])}
          </Text>
        </XStack>
      ) : null}
      {isPending && keyRejected ? <QerkoKeyRejected /> : null}
      {attempt.status === "failed" ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t(
              attempt.failureReason === "cancelled"
                ? "refund.qerko.failed.cancelled"
                : "refund.qerko.failed.declined"
            )}
          </Text>
          <Button
            variant="outline"
            label={t("refund.qerko.dismiss")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
      {attempt.status === "unknown" ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t("refund.qerko.unresolved")}
          </Text>
          <Button
            variant="outline"
            label={t("refund.qerko.dismissUnresolved")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
    </YStack>
  )
}

type SwitchioRefundAttemptRow = InferRow<
  ReturnType<typeof cardSwitchioRefundAttemptsByPaymentIdQuery>
>

/**
 * A refund to the card through SwitchioPay that is not written as a refund
 * (refund/0007). Only the phone that launched it can ask its SwitchioPay
 * what became of it; any device can dismiss it once staff checked, a
 * pending one too, since its phone may be gone.
 */
function SwitchioRefundAttempt({
  attempt,
  formatMinor,
}: {
  readonly attempt: SwitchioRefundAttemptRow
  readonly formatMinor: (value: NonNegativeInteger) => string
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const toast = useToast()
  const confirm = useConfirm()
  const { device } = useAtomValue(accountAtom)
  const [checking, setChecking] = useState(false)
  const isOwnPhone = attempt.deviceId === device.id
  // On its own phone a pending attempt is waiting on SwitchioPay right now;
  // `SwitchioRestoredRefund` asks about it once nothing is.
  const waitingHere = attempt.status === "pending" && isOwnPhone

  const dismiss = async () => {
    if (attempt.status === "pending") {
      const confirmed = await confirm({
        title: t("refund.switchio.dismissPending.title"),
        description: t("refund.switchio.dismissPending.description"),
        confirmLabel: t("refund.switchio.dismissPending.confirm"),
        cancelLabel: t("refund.switchio.dismissPending.cancel"),
        variant: "destructive",
      })
      if (!confirmed) return
    }
    await runToast(async (run) => {
      await run.ok(dismissCardSwitchioRefundAttempt(attempt.id))
    })
  }

  const check = async () => {
    if (checking || isSwitchioRefundInFlight()) return
    setChecking(true)
    let refunded = false
    await runToast(async (run) => {
      const result = await run(
        resolveCardSwitchioRefundAttempt({
          attemptId: attempt.id,
          deviceId: device.id,
        })
      )
      // Only another phone is refused: its terminal never saw the refund.
      if (!result.ok) return "refund.switchio.error.otherDevice"
      if (result.value.status === "unresolved") {
        return "refund.switchio.unresolved"
      }
      refunded = result.value.status === "refunded"
      return undefined
    })
    setChecking(false)
    if (refunded) toast.success(t("refund.switchio.done"))
  }

  return (
    <YStack
      testID="payment-detail-switchio-refund"
      gap={8}
      bg="neutral-soft"
      rounded={8}
      px={12}
      py={8}
    >
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {t("refund.switchio.pending")} ·{" "}
        {formatMinor(
          // The tip a whole-payment refund returns beside the goods.
          NonNegativeInteger(attempt.amount + (attempt.tipAmount ?? 0))
        )}
      </Text>
      {waitingHere ? <ActivityIndicator /> : null}
      {attempt.status === "pending" && !isOwnPhone ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("refund.switchio.pendingElsewhere")}
          </Text>
          <Button
            variant="outline"
            label={t("refund.qerko.dismissUnresolved")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
      {attempt.status === "failed" ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t("refund.switchio.failed")}
          </Text>
          <Button
            variant="outline"
            label={t("refund.qerko.dismiss")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
      {attempt.status === "unknown" ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t("refund.switchio.unresolved")}
          </Text>
          {isOwnPhone ? (
            <Button
              variant="outline"
              iconStart={RotateCw}
              pending={checking}
              label={t("refund.switchio.check")}
              onPress={() => void check()}
            />
          ) : null}
          <Button
            variant="outline"
            label={t("refund.qerko.dismissUnresolved")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
    </YStack>
  )
}
