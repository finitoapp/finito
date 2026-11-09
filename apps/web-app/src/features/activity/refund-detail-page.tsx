import type { InferRow } from "@evolu/common"
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
import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { ChevronRightIcon } from "lucide-react"
import { Suspense } from "react"
import { DetailRow } from "@/components/detail-row.tsx"
import { FadeHeader } from "@/components/fade-header.tsx"
import { NotFoundCard } from "@/components/not-found-card.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { Separator } from "@/components/ui/separator.tsx"
import {
  PaymentDetailCopyRow,
  PaymentDetailSkeleton,
  PaymentDetailTechnical,
} from "@/features/activity/payment-detail.tsx"
import { RefundEetReversal } from "@/features/activity/refund-eet-reversal.tsx"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney } from "@/lib/format-utils.ts"

type RefundDetailRow = InferRow<ReturnType<typeof refundByIdQuery>>

const cardSwitchioKindKeys = {
  reversal: "refundDetail.card.kind.reversal",
  referralRefund: "refundDetail.card.kind.referralRefund",
} satisfies Record<
  NonNullable<RefundDetailRow["cardSwitchioKind"]>,
  TranslationKey
>

/**
 * `/activity/$paymentId/refunds/$refundId`: one recorded refund, read-only
 * (docs/plans/refund-detail.md), opened from its row on the payment detail
 * only. Each refund stands alone: the tip refunded beside the goods of a
 * whole payment is a refund of its own, not shown here. Its one action is
 * the resend of its EET reversal.
 */
export function RefundDetailPage({
  paymentId,
  refundId,
}: {
  readonly paymentId: string
  readonly refundId: string
}) {
  const { t } = useTranslation()
  const parsedPaymentId = PaymentId.safeParse(paymentId)
  const parsedRefundId = RefundId.safeParse(refundId)

  return (
    <>
      <FadeHeader title={t("refundDetail.title")} />

      <section className="pt-16">
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
      </section>
    </>
  )
}

function RefundDetail({
  paymentId,
  refundId,
}: {
  readonly paymentId: PaymentId
  readonly refundId: RefundId
}) {
  usePreloadEvoluQueries([
    refundByIdQuery(refundId),
    refundLinesByRefundIdQuery(refundId),
    eetReversalByRefundIdQuery(refundId),
    paymentDetailQuery(paymentId),
    paymentNumberByPaymentIdQuery(paymentId),
  ])
  const { t } = useTranslation()
  const locale = useLocale()
  const router = useRouter()
  const navigate = useNavigate()
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
  const isTip = isTipRefund(refund)

  // The payment detail is right under this screen; Back to it rather than a
  // second copy on top.
  const backToPayment = () => {
    if (router.history.canGoBack()) router.history.back()
    else
      void navigate({
        to: "/activity/$paymentId",
        params: { paymentId },
        replace: true,
      })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card data-testid="refund-detail">
        <CardHeader>
          <CardTitle>{t(refundMethodLabelKey[refund.method])}</CardTitle>
          <CardDescription>
            {formatDateTime(new Date(refund.refundedAt), locale)}
          </CardDescription>
          {isTip ? (
            <CardAction>
              <Badge variant="secondary">
                {t("paymentDetail.refunds.tip")}
              </Badge>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <strong className="text-4xl font-semibold tracking-tight tabular-nums">
            {money(refund.amount)}
          </strong>
          <Separator />
          {payment === undefined ? null : (
            <DetailRow label={t("refundDetail.payment")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={backToPayment}
              >
                {paymentNumber === undefined
                  ? money(payment.amount)
                  : `${t("paymentDetail.number", {
                      number: paymentNumber.serialNumber,
                    })} · ${money(payment.amount)}`}
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </DetailRow>
          )}
          <DetailRow
            label={t("refundDetail.what")}
            value={t(
              isTip ? "paymentDetail.refunds.tip" : "refundDetail.what.goods"
            )}
          />
          {refund.deviceName === null ? null : (
            <DetailRow
              label={t("refundDetail.device")}
              value={refund.deviceName}
            />
          )}
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
        <Card data-testid="refund-detail-qerko">
          <CardHeader>
            <CardTitle>{t("refundDetail.qerko.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("refundDetail.qerko.description")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {lines.length === 0 ? null : (
        <Card data-testid="refund-detail-lines">
          <CardHeader>
            <CardTitle>{t("refundDetail.lines.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
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
        <Card data-testid="refund-detail-eet">
          <CardHeader>
            <CardTitle>{t("paymentDetail.eet.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RefundEetReversal reversal={reversal} />
          </CardContent>
        </Card>
      )}

      <PaymentDetailTechnical>
        <PaymentDetailCopyRow label={t("refundDetail.id")} value={refund.id} />
      </PaymentDetailTechnical>
    </div>
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
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link to="/activity/bills/$billId" params={{ billId }} />}
      >
        {bill.label ?? t("bill.list.label", { number: bill.displayNumber })}
        <ChevronRightIcon data-icon="inline-end" />
      </Button>
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
    <Card data-testid="refund-detail-cash">
      <CardHeader>
        <CardTitle>{t("refundDetail.cash.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
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
    <Card data-testid="refund-detail-card">
      <CardHeader>
        <CardTitle>{t("refundDetail.card.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {switchio === null ? null : (
          <>
            <DetailRow
              label={t("refundDetail.card.kind")}
              value={t(cardSwitchioKindKeys[switchio.kind])}
            />
            <PaymentDetailCopyRow
              label={t("refundDetail.card.transactionId")}
              value={switchio.transactionId}
            />
            <PaymentDetailCopyRow
              label={t("refundDetail.card.authCode")}
              value={refund.cardSwitchioAuthCode}
            />
            <PaymentDetailCopyRow
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
            <PaymentDetailCopyRow
              label={t("refundDetail.card.transactionId")}
              value={qerko.transactionId}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
