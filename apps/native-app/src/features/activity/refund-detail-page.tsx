import type { InferRow } from "@evolu/common"
import { formatDateTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { refundMethodLabelKey } from "@payky/app-shared/refund-form"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { eetReversalByRefundIdQuery } from "@payky/core/modules/eet/eet-queries"
import { paymentDetailQuery } from "@payky/core/modules/payment/payment-queries"
import { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentNumberByPaymentIdQuery } from "@payky/core/modules/payment-number/payment-number-queries"
import {
  refundByIdQuery,
  refundLinesByRefundIdQuery,
} from "@payky/core/modules/refund/refund-queries"
import { RefundId } from "@payky/core/modules/refund/refund-types"
import { isTipRefund } from "@payky/core/modules/refund/refund-utils"
import { Integer } from "@payky/core/modules/shared/schema"
import { router, useLocalSearchParams } from "expo-router"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import { Suspense, useMemo } from "react"
import { Text, YStack } from "tamagui"
import { AmountFigure } from "../../components/amount-figure.tsx"
import { DetailRow } from "../../components/detail-row.tsx"
import { NotFoundCard } from "../../components/not-found-card.tsx"
import { Badge } from "../../components/ui/badge.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
import { Separator } from "../../components/ui/separator.tsx"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney, formatMoneyParts } from "../../lib/format-money.ts"
import { fontSize } from "../../theme/tokens.ts"
import { DetailScreen, OptionalRow, Technical } from "./detail-parts.tsx"
import { PaymentDetailSkeleton } from "./payment-detail-page.tsx"
import { RefundEetReversal } from "./refund-eet-reversal.tsx"

type RefundDetailRow = InferRow<ReturnType<typeof refundByIdQuery>>

const cardSwitchioKindKeys = {
  reversal: "refundDetail.card.kind.reversal",
  referralRefund: "refundDetail.card.kind.referralRefund",
} satisfies Record<
  NonNullable<RefundDetailRow["cardSwitchioKind"]>,
  TranslationKey
>

/**
 * `/activity/[paymentId]/refunds/[refundId]`: one recorded refund, read-only
 * (docs/plans/refund-detail.md), opened from its row on the payment detail
 * only. Each refund stands alone: the tip refunded beside the goods of a
 * whole payment is a refund of its own, not shown here. Its one action is
 * the resend of its EET reversal.
 */
export function RefundDetailPage() {
  const { t } = useTranslation()
  const { paymentId, refundId } = useLocalSearchParams<{
    paymentId: string
    refundId: string
  }>()
  const parsedPaymentId = PaymentId.safeParse(paymentId)
  const parsedRefundId = RefundId.safeParse(refundId)

  return (
    <DetailScreen title={t("refundDetail.title")}>
      {parsedPaymentId.success && parsedRefundId.success ? (
        <Suspense fallback={<PaymentDetailSkeleton />}>
          <RefundDetail
            paymentId={parsedPaymentId.data}
            refundId={parsedRefundId.data}
          />
        </Suspense>
      ) : (
        <NotFoundCard messageKey="refundDetail.notFound" />
      )}
    </DetailScreen>
  )
}

function RefundDetail({
  paymentId,
  refundId,
}: {
  readonly paymentId: PaymentId
  readonly refundId: RefundId
}) {
  usePreloadEvoluQueries(
    useMemo(
      () => [
        refundByIdQuery(refundId),
        refundLinesByRefundIdQuery(refundId),
        eetReversalByRefundIdQuery(refundId),
        paymentDetailQuery(paymentId),
        paymentNumberByPaymentIdQuery(paymentId),
      ],
      [paymentId, refundId]
    )
  )
  const { t } = useTranslation()
  const locale = useLocale()
  const [refund] = useEvoluQuery(refundByIdQuery(refundId)).data
  const lines = useEvoluQuery(refundLinesByRefundIdQuery(refundId)).data
  const [reversal] = useEvoluQuery(eetReversalByRefundIdQuery(refundId)).data
  const [payment] = useEvoluQuery(paymentDetailQuery(paymentId)).data
  const [paymentNumber] = useEvoluQuery(
    paymentNumberByPaymentIdQuery(paymentId)
  ).data

  // A deleted refund, one of another payment, or one not synced yet.
  if (refund === undefined || refund.paymentId !== paymentId)
    return <NotFoundCard messageKey="refundDetail.notFound" />

  const money = (value: Integer) =>
    formatMoney({ value, currency: refund.currency }, locale)
  const headline = formatMoneyParts(
    { value: refund.amount, currency: refund.currency },
    locale
  )
  const isTip = isTipRefund(refund)

  return (
    <YStack gap={16}>
      <Card testID="refund-detail">
        <CardHeader>
          <CardTitle>{t(refundMethodLabelKey[refund.method])}</CardTitle>
          <CardDescription>
            {formatDateTime(new Date(refund.refundedAt), locale)}
          </CardDescription>
          {isTip ? (
            <CardAction>
              <Badge
                variant="secondary"
                label={t("paymentDetail.refunds.tip")}
              />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent gap={12}>
          <AmountFigure
            align="start"
            number={headline.number}
            unit={headline.unit}
            unitFirst={headline.unitFirst}
            label={headline.text}
          />
          <Separator />
          {payment === undefined ? null : (
            <DetailRow label={t("refundDetail.payment")}>
              <Button
                size="sm"
                variant="ghost"
                iconEnd={ChevronRight}
                label={
                  paymentNumber === undefined
                    ? money(payment.amount)
                    : `${t("paymentDetail.number", {
                        number: paymentNumber.serialNumber,
                      })} · ${money(payment.amount)}`
                }
                // The payment detail is right under this screen; Back to it
                // rather than a second copy on top.
                onPress={() =>
                  router.dismissTo({
                    pathname: "/activity/[paymentId]",
                    params: { paymentId },
                  })
                }
              />
            </DetailRow>
          )}
          <DetailRow
            label={t("refundDetail.what")}
            value={t(
              isTip ? "paymentDetail.refunds.tip" : "refundDetail.what.goods"
            )}
          />
          <OptionalRow
            label={t("refundDetail.device")}
            value={refund.deviceName}
          />
          {payment === undefined || payment.billId === null ? null : (
            <Suspense fallback={null}>
              <RefundBillRow billId={payment.billId} />
            </Suspense>
          )}
        </CardContent>
      </Card>

      {refund.method === "cashRegister" ? (
        <RefundCashCard refund={refund} money={money} />
      ) : null}

      <RefundCardCard refund={refund} />

      {refund.method === "qerkoPayment" ? (
        <Card testID="refund-detail-qerko">
          <CardHeader>
            <CardTitle>{t("refundDetail.qerko.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >
              {t("refundDetail.qerko.description")}
            </Text>
          </CardContent>
        </Card>
      ) : null}

      {lines.length === 0 ? null : (
        <Card testID="refund-detail-lines">
          <CardHeader>
            <CardTitle>{t("refundDetail.lines.title")}</CardTitle>
          </CardHeader>
          <CardContent gap={8}>
            {lines.map((line) => (
              <DetailRow
                key={line.id}
                label={`${line.quantity} × ${line.name}`}
                value={money(line.amount)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {reversal === undefined ? null : (
        <Card testID="refund-detail-eet">
          <CardHeader>
            <CardTitle>{t("paymentDetail.eet.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RefundEetReversal reversal={reversal} />
          </CardContent>
        </Card>
      )}

      <Technical>
        <OptionalRow mono label={t("refundDetail.id")} value={refund.id} />
      </Technical>
    </YStack>
  )
}

/** The bill the refunded payment paid, as a link to its detail. */
function RefundBillRow({ billId }: { readonly billId: BillId }) {
  const { t } = useTranslation()
  const [bill] = useEvoluQuery(billByIdQuery(billId)).data
  // The bill row is gone or still syncing: the refund stands without it.
  if (bill === undefined) return null
  return (
    <DetailRow label={t("paymentDetail.bill.title")}>
      <Button
        size="sm"
        variant="ghost"
        iconEnd={ChevronRight}
        label={
          bill.label ?? t("bill.list.label", { number: bill.displayNumber })
        }
        onPress={() =>
          router.push({
            pathname: "/activity/bills/[billId]",
            params: { billId },
          })
        }
      />
    </DetailRow>
  )
}

/**
 * The cash a refund from the register handed out (refund/0012): whole
 * crowns, so it may differ from the amount recorded by the rounding. A
 * refund written before `refundCashRegister` handed out exactly its amount.
 */
function RefundCashCard({
  refund,
  money,
}: {
  readonly refund: RefundDetailRow
  readonly money: (value: Integer) => string
}) {
  const { t } = useTranslation()
  const handed = refund.cashHandedAmount ?? refund.amount
  const rounding = Integer(handed - refund.amount)
  return (
    <Card testID="refund-detail-cash">
      <CardHeader>
        <CardTitle>{t("refundDetail.cash.title")}</CardTitle>
      </CardHeader>
      <CardContent gap={8}>
        <DetailRow
          emphasize
          label={t("refundDetail.cash.handed")}
          value={money(handed)}
        />
        {rounding === 0 ? null : (
          <DetailRow
            label={t("refundDetail.cash.rounding")}
            value={`${rounding > 0 ? "+" : ""}${money(rounding)}`}
          />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * What the card terminal answered for a refund to the card: how SwitchioPay
 * returned it (refund/0008) and the ids staff match against the terminal's
 * statement. A refund recorded before that was kept has none.
 */
function RefundCardCard({ refund }: { readonly refund: RefundDetailRow }) {
  const { t } = useTranslation()
  const switchio =
    refund.method === "cardSwitchio" &&
    refund.cardSwitchioTransactionId !== null &&
    refund.cardSwitchioKind !== null
      ? {
          transactionId: refund.cardSwitchioTransactionId,
          kind: refund.cardSwitchioKind,
        }
      : null
  const qerko =
    refund.method === "qerkoTerminal" &&
    refund.qerkoTerminalTransactionId !== null &&
    refund.qerkoTerminalTerminalId !== null
      ? {
          transactionId: refund.qerkoTerminalTransactionId,
          terminalId: refund.qerkoTerminalTerminalId,
        }
      : null
  if (switchio === null && qerko === null) return null
  return (
    <Card testID="refund-detail-card">
      <CardHeader>
        <CardTitle>{t("refundDetail.card.title")}</CardTitle>
      </CardHeader>
      <CardContent gap={8}>
        {switchio === null ? null : (
          <>
            <DetailRow
              label={t("refundDetail.card.kind")}
              value={t(cardSwitchioKindKeys[switchio.kind])}
            />
            <DetailRow
              mono
              label={t("refundDetail.card.transactionId")}
              value={switchio.transactionId}
            />
            <OptionalRow
              mono
              label={t("refundDetail.card.authCode")}
              value={refund.cardSwitchioAuthCode}
            />
            <OptionalRow
              mono
              label={t("refundDetail.card.sequenceNumber")}
              value={refund.cardSwitchioSequenceNumber}
            />
          </>
        )}
        {qerko === null ? null : (
          <>
            <DetailRow
              label={t("refundDetail.card.terminalId")}
              value={qerko.terminalId}
            />
            <DetailRow
              mono
              label={t("refundDetail.card.transactionId")}
              value={qerko.transactionId}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
