import type { InferRow } from "@evolu/common"
import {
  billStatusLabelKey,
  paymentStatusLabelKey,
} from "@payky/app-shared/activity-labels"
import { useNow } from "@payky/app-shared/use-now"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import { BillId } from "@payky/core/modules/bill/bill-types"
import { deriveBillOverpayment } from "@payky/core/modules/bill/bill-utils"
import {
  calculateTaxRecap,
  hasTaxableLines,
} from "@payky/core/modules/bill-line/bill-line-tax-utils"
import {
  deriveBillSummaryTotal,
  getBillLineSummaryUnitAmount,
} from "@payky/core/modules/bill-line/bill-line-utils"
import { eetSalesByBillIdQuery } from "@payky/core/modules/eet/eet-queries"
import { paymentsWithClaimsByBillIdQuery } from "@payky/core/modules/payment/payment-queries"
import {
  derivePaymentHasCancellationCollision,
  derivePaymentStatus,
} from "@payky/core/modules/payment/payment-status-utils"
import { refundSummariesByBillIdQuery } from "@payky/core/modules/refund/refund-queries"
import {
  type PaymentRefundSummary,
  summarizeRefundsByPayment,
} from "@payky/core/modules/refund/refund-utils"
import {
  type FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import {
  projectSelfPayViewLine,
  sumSelfPayAllocationsByLineKey,
} from "@payky/core/modules/table-self-pay/table-self-pay-projection-utils"
import { selfPayAllocationsByBillIdQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { Link, useRouter } from "@tanstack/react-router"
import { DetailRow } from "@/components/detail-row.tsx"
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
import { PaymentMethodIcons } from "@/features/activity/activity-row.tsx"
import { BillCancellationCollisionPanel } from "@/features/activity/bill-cancellation-collision-panel.tsx"
import { BillCoverageWarning } from "@/features/activity/bill-coverage-warning.tsx"
import { billStatusBadgeClassName } from "@/features/activity/bill-status-display.ts"
import { OverpaymentCard } from "@/features/activity/overpayment-card.tsx"
import {
  PaymentDetailCopyRow,
  PaymentDetailTechnical,
} from "@/features/activity/payment-detail.tsx"
import {
  PaymentStatusIcon,
  paymentStatusBadgeClassName,
} from "@/features/activity/payment-status-display.tsx"
import { useBillCoverage } from "@/features/activity/use-bill-coverage.ts"
import { billStateQueries } from "@/features/shared/bill-state-queries.ts"
import { EetSaleStatusBadge } from "@/features/shared/eet-sale-status.tsx"
import { RefundBadge } from "@/features/shared/refund-badge.tsx"
import { TaxRecap } from "@/features/shared/tax-recap.tsx"
import { useBillLineSummaries } from "@/features/shared/use-bill-line-summaries.ts"
import { useBillStatus } from "@/features/shared/use-bill-status.ts"
import { useOverpaymentInput } from "@/features/shared/use-overpayment-input.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

type BillDetailPaymentRowData = InferRow<
  ReturnType<typeof paymentsWithClaimsByBillIdQuery>
>
type BillDetailEetSale = InferRow<ReturnType<typeof eetSalesByBillIdQuery>>

export function BillDetail({
  billId,
  afterEdit = false,
}: {
  readonly billId: string
  readonly afterEdit?: boolean
}) {
  const parsedBillId = BillId.safeParse(billId)

  if (!parsedBillId.success) {
    return <NotFoundCard messageKey="billDetail.invalidId" />
  }

  return <BillDetailContent billId={parsedBillId.data} afterEdit={afterEdit} />
}

function BillDetailContent({
  billId,
  afterEdit,
}: {
  readonly billId: BillId
  readonly afterEdit: boolean
}) {
  usePreloadEvoluQueries([
    ...billStateQueries(billId),
    tablesQuery,
    taxRatesQuery,
    paymentsWithClaimsByBillIdQuery(billId),
    eetSalesByBillIdQuery(billId),
    refundSummariesByBillIdQuery(billId),
  ])
  const { t } = useTranslation()
  const locale = useLocale()
  const router = useRouter()
  const query = billByIdQuery(billId)
  const { data: bills } = useEvoluQuery(query)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)
  const summaries = useBillLineSummaries(billId)
  const billStatus = useBillStatus(billId)
  const { claimedSum, coverage } = useBillCoverage(billId)
  const paymentsQuery = paymentsWithClaimsByBillIdQuery(billId)
  const { data: payments } = useEvoluQuery(paymentsQuery)
  const { data: eetSales } = useEvoluQuery(eetSalesByBillIdQuery(billId))
  const { data: refunds } = useEvoluQuery(refundSummariesByBillIdQuery(billId))
  const refundsByPayment = summarizeRefundsByPayment(refunds)
  const { data: allocations } = useEvoluQuery(
    selfPayAllocationsByBillIdQuery(billId)
  )
  const overpaymentInput = useOverpaymentInput({ billId })
  const bill = bills[0]

  if (!bill || billStatus === undefined) {
    return <NotFoundCard messageKey="billDetail.notFound" />
  }

  const table = tables.find((candidate) => candidate.id === bill.tableId)
  const billLabel =
    bill.label ?? t("bill.list.label", { number: bill.displayNumber })
  const totalAmount = deriveBillSummaryTotal(summaries)
  const taxRecapRows = calculateTaxRecap(summaries, taxRates)
  const hasTaxRecap = hasTaxableLines(taxRecapRows)
  const selfPayAllocated = sumSelfPayAllocationsByLineKey(allocations)
  const isOverpaymentUnresolved =
    overpaymentInput !== undefined &&
    deriveBillOverpayment(overpaymentInput).unresolved > 0
  const overpaymentCard = (
    <OverpaymentCard
      scope={{ billId }}
      billLabel={billLabel}
      currency={bill.currency}
      onDecideLater={afterEdit ? () => router.history.back() : undefined}
      payments={payments.map((payment) => ({
        id: payment.id,
        number: payment.serialNumber,
        amount: payment.amount,
        methods: payment.claimedTransactions.map(({ kind }) => kind),
        createdAt: payment.createdAt,
        canceledAt: payment.canceledAt,
        confirmedPaidAt: payment.confirmedPaidAt,
      }))}
    />
  )

  const closedOrCanceledLabel =
    billStatus.status === "closed" && bill.closedAt !== null
      ? t("billDetail.closedAtValue", {
          date: formatDateTime(new Date(bill.closedAt), locale),
        })
      : billStatus.status === "canceled" && bill.canceledAt !== null
        ? t("billDetail.canceledAtValue", {
            date: formatDateTime(new Date(bill.canceledAt), locale),
          })
        : null

  return (
    <div className="flex flex-col gap-4">
      {billStatus.status === "open" ? (
        <Button
          className="h-12"
          nativeButton={false}
          render={<Link to="/bill" search={{ billId }} />}
        >
          {t("billDetail.backToBill")}
        </Button>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{billLabel}</CardTitle>
          <CardDescription>
            {formatDateTime(new Date(bill.createdAt), locale)}
          </CardDescription>
          <CardAction>
            <Badge
              variant={
                billStatus.status === "canceled" ? "destructive" : "secondary"
              }
              className={cn(billStatusBadgeClassName[billStatus.status])}
            >
              {t(billStatusLabelKey[billStatus.status])}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <strong className="text-4xl font-semibold tracking-tight tabular-nums">
              {formatMoney(
                { value: totalAmount, currency: bill.currency },
                locale
              )}
            </strong>
            {closedOrCanceledLabel === null ? null : (
              <span className="text-sm text-muted-foreground">
                {closedOrCanceledLabel}
              </span>
            )}
          </div>

          {isOverpaymentUnresolved ? overpaymentCard : null}

          {/*
           * Spelled out rather than "—": a counter sale with no table is a
           * fact staff should read, not a missing value. "—" stays for a
           * tableId whose table row is gone (deleted since).
           */}
          <DetailRow label={t("billDetail.table")}>
            {bill.tableId === null ? (
              <span className="text-muted-foreground">
                {t("billDetail.noTable")}
              </span>
            ) : (
              (table?.name ?? t("billDetail.emptyValue"))
            )}
          </DetailRow>

          {billStatus.hasCancellationCollision ? (
            <BillCancellationCollisionPanel billId={billId} />
          ) : null}

          <Separator />

          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("billDetail.items.empty")}
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {summaries.map((summary) => (
                <div
                  key={summary.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {summary.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {summary.quantity} ×{" "}
                      {formatMoney(
                        {
                          value: getBillLineSummaryUnitAmount(summary),
                          currency: summary.currency,
                        },
                        locale
                      )}
                    </p>
                    <SelfPayLinePaid
                      paid={
                        projectSelfPayViewLine(summary, selfPayAllocated)
                          .allocatedAmount
                      }
                      total={summary.totalAmount}
                      currency={summary.currency}
                      locale={locale}
                    />
                  </div>
                  <p className="text-sm font-semibold">
                    {formatMoney(
                      {
                        value: summary.totalAmount,
                        currency: summary.currency,
                      },
                      locale
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          {hasTaxRecap ? (
            <>
              <Separator />
              <TaxRecap
                rows={taxRecapRows}
                currency={bill.currency}
                locale={locale}
              />
            </>
          ) : null}

          {coverage === "underpaid" ? (
            <>
              <Separator />
              <BillCoverageWarning
                coverage={{ type: "underpaid" }}
                expectedAmount={totalAmount}
                claimedSum={claimedSum}
                currency={bill.currency}
              />
            </>
          ) : null}

          {isOverpaymentUnresolved ? null : overpaymentCard}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("billDetail.payments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("billDetail.payments.empty")}
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {payments.map((payment) => (
                <BillDetailPaymentRow
                  key={payment.id}
                  payment={payment}
                  eetSale={eetSales.find(
                    (sale) => sale.paymentId === payment.id
                  )}
                  refundSummary={refundsByPayment.get(payment.id)}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentDetailTechnical>
        <PaymentDetailCopyRow label={t("billDetail.id")} value={bill.id} />
        <PaymentDetailCopyRow
          label={t("paymentDetail.deviceId")}
          value={bill.deviceId}
        />
        {bill.updatedAt === null ? null : (
          <DetailRow
            label={t("paymentDetail.updatedAt")}
            value={formatDateTime(new Date(bill.updatedAt), locale)}
          />
        )}
      </PaymentDetailTechnical>
    </div>
  )
}

function SelfPayLinePaid({
  paid,
  total,
  currency,
  locale,
}: {
  readonly paid: number
  readonly total: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly locale: string
}) {
  const { t } = useTranslation()
  if (paid === 0) return null

  return (
    <p className="text-xs text-primary">
      {t("billDetail.selfPay.linePaid", {
        paid: formatMoney(
          { value: NonNegativeInteger(paid), currency },
          locale
        ),
        total: formatMoney({ value: total, currency }, locale),
      })}
    </p>
  )
}

function BillDetailPaymentRow({
  payment,
  eetSale,
  refundSummary,
  locale,
}: {
  readonly payment: BillDetailPaymentRowData
  readonly eetSale: BillDetailEetSale | undefined
  readonly refundSummary: PaymentRefundSummary | undefined
  readonly locale: string
}) {
  const { t } = useTranslation()
  const claimCount = payment.claimedTransactions.length
  const now = useNow([payment.expiresAt])
  const status = derivePaymentStatus({
    canceledAt: payment.canceledAt,
    confirmedPaidAt: payment.confirmedPaidAt,
    expiresAt: payment.expiresAt,
    hasActiveClaim: claimCount > 0,
    now,
  })
  const hasCancellationCollision = derivePaymentHasCancellationCollision({
    canceledAt: payment.canceledAt,
    confirmedPaidAt: payment.confirmedPaidAt,
    hasActiveClaim: claimCount > 0,
  })
  const amount = formatMoney(
    { value: payment.amount, currency: payment.currency },
    locale
  )

  return (
    <Link
      to="/activity/$paymentId"
      params={{ paymentId: payment.id }}
      className="-mx-1 flex items-center gap-3 rounded-md px-1 py-2 hover:bg-accent/50"
    >
      <PaymentStatusIcon
        status={status}
        hasCancellationCollision={hasCancellationCollision}
      />
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">
          {payment.serialNumber === null
            ? amount
            : t("billDetail.payments.numberedAmount", {
                number: payment.serialNumber,
                amount,
              })}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {formatDateTime(new Date(payment.createdAt), locale)}
          <PaymentMethodIcons
            kinds={payment.claimedTransactions.map(({ kind }) => kind)}
          />
        </span>
      </div>
      <span className="flex flex-col items-end gap-1">
        <Badge
          variant={status === "canceled" ? "destructive" : "secondary"}
          className={cn(paymentStatusBadgeClassName[status])}
        >
          {t(paymentStatusLabelKey[status])}
        </Badge>
        <RefundBadge summary={refundSummary} />
        {payment.selfPayId === null ? null : (
          <Badge variant="outline">{t("billDetail.selfPay")}</Badge>
        )}
        {eetSale === undefined ? null : <EetSaleStatusBadge sale={eetSale} />}
      </span>
    </Link>
  )
}
