import type { InferRow } from "@evolu/common"
import {
  derivePaymentBillCoverageNotice,
  derivePaymentDetailState,
} from "@payky/app-shared/activity-detail"
import {
  billStatusLabelKey,
  paymentMethodLabelKey,
  paymentStatusLabelKey,
} from "@payky/app-shared/activity-labels"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useNow } from "@payky/app-shared/use-now"
import type { EetDeliveryOutcome } from "@payky/core/integrations/eet/eet-client"
import { claimedPaymentsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { allocateDiscount } from "@payky/core/modules/bill-line/bill-line-discount-utils"
import {
  calculateTaxRecap,
  hasTaxableLines,
} from "@payky/core/modules/bill-line/bill-line-tax-utils"
import {
  deriveBillSummaryTotal,
  getBillLineSummaryUnitAmount,
} from "@payky/core/modules/bill-line/bill-line-utils"
import {
  type DeliverEetSaleError,
  retryEetSale,
} from "@payky/core/modules/eet/eet-actions"
import { eetSalesByPaymentIdQuery } from "@payky/core/modules/eet/eet-queries"
import {
  parseEetDateTime,
  parseEetWarnings,
} from "@payky/core/modules/eet/eet-utils"
import {
  acknowledgePaymentExcessSettlement,
  confirmPaymentPaidDespiteCancellation,
} from "@payky/core/modules/payment/payment-actions"
import {
  paymentDetailQuery,
  paymentQerkoTerminalByIdQuery,
  paymentReconciliationsQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "@payky/core/modules/payment/payment-queries"
import { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentNumberByPaymentIdQuery } from "@payky/core/modules/payment-number/payment-number-queries"
import {
  Integer,
  type NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { Link, useNavigate } from "@tanstack/react-router"
import { parseISO } from "date-fns"
import { useAtomValue } from "jotai"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  RotateCwIcon,
} from "lucide-react"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import { CollisionAlert } from "@/components/collision-alert.tsx"
import { DetailRow } from "@/components/detail-row.tsx"
import { NotFoundCard } from "@/components/not-found-card.tsx"
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline.tsx"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import { Separator } from "@/components/ui/separator.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { BillCancellationCollisionPanel } from "@/features/activity/bill-cancellation-collision-panel.tsx"
import { BillCoverageWarning } from "@/features/activity/bill-coverage-warning.tsx"
import { billStatusBadgeClassName } from "@/features/activity/bill-status-display.ts"
import { PaymentQerkoAttempts } from "@/features/activity/payment-qerko-attempts.tsx"
import { PaymentDetailRefunds } from "@/features/activity/payment-refunds.tsx"
import { paymentStatusBadgeClassName } from "@/features/activity/payment-status-display.tsx"
import { useBillCoverage } from "@/features/activity/use-bill-coverage.ts"
import {
  billLineSummaryDiffQueries,
  useBillLineSummaryDiff,
  usePaymentLineSummaries,
} from "@/features/activity/use-bill-line-summary-diff.ts"
import { paymentRefundsQueries } from "@/features/activity/use-payment-refund-state.ts"
import { billStateQueries } from "@/features/shared/bill-state-queries.ts"
import {
  EetSaleStatusBadge,
  useEetRecordingDeviceWait,
  useEetSaleStatus,
} from "@/features/shared/eet-sale-status.tsx"
import { paymentMethodIcon } from "@/features/shared/payment-method-display.tsx"
import { TaxRecap } from "@/features/shared/tax-recap.tsx"
import { useBillLineSummaries } from "@/features/shared/use-bill-line-summaries.ts"
import { useBillStatus } from "@/features/shared/use-bill-status.ts"
import { useRequirePermission } from "@/hooks/use-access.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { copyToClipboard } from "@/lib/clipboard.ts"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

type PaymentDetailClaimSource = "auto" | "manual"

const claimSourceLabelKey = {
  auto: "paymentDetail.reconciliation.source.auto",
  manual: "paymentDetail.reconciliation.source.manual",
} satisfies Record<PaymentDetailClaimSource, TranslationKey>

export function PaymentDetail({ paymentId }: { readonly paymentId: string }) {
  const parsedPaymentId = PaymentId.safeParse(paymentId)

  if (!parsedPaymentId.success) {
    return <NotFoundCard messageKey="paymentDetail.invalidId" />
  }

  return <PaymentDetailContent paymentId={parsedPaymentId.data} />
}

/** Suspense fallback shaped like the summary card, so the page doesn't flash empty. */
export function PaymentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  )
}

function PaymentDetailContent({
  paymentId,
}: {
  readonly paymentId: PaymentId
}) {
  // This card's queries and those of the cards below that need only the
  // payment's id; `PaymentDetailBillCard` preloads its own once the bill id
  // is read.
  usePreloadEvoluQueries([
    paymentDetailQuery(paymentId),
    paymentReconciliationsQuery(paymentId),
    paymentNumberByPaymentIdQuery(paymentId),
    eetSalesByPaymentIdQuery(paymentId),
    qerkoPaymentAttemptsByPaymentIdQuery(paymentId),
    ...paymentRefundsQueries(paymentId),
  ])
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const navigate = useNavigate()
  const [resolvePending, setResolvePending] = useState(false)
  const [excessResolvePending, setExcessResolvePending] = useState(false)
  const query = paymentDetailQuery(paymentId)
  const reconciliationsQuery = paymentReconciliationsQuery(paymentId)
  const paymentNumberQuery = paymentNumberByPaymentIdQuery(paymentId)
  const { data: payments } = useEvoluQuery(query)
  const { data: reconciliations } = useEvoluQuery(reconciliationsQuery)
  const { data: paymentNumbers } = useEvoluQuery(paymentNumberQuery)
  const { data: qerkoPaymentData } = useEvoluQuery(
    paymentQerkoTerminalByIdQuery(paymentId)
  )
  // The terminal's TID tells staff which one took the card (qerko/0006).
  const qerkoTerminalTid = qerkoPaymentData[0]?.terminalTid ?? null
  const payment = payments[0]
  const paymentNumber = paymentNumbers[0]
  // Read before the early return below, so the hook order stays stable.
  // Nothing writes a row when a payment expires; see `useNow`.
  const now = useNow([payment?.expiresAt ?? null])

  if (!payment) {
    return <NotFoundCard messageKey="paymentDetail.notFound" />
  }

  const {
    status: paymentStatus,
    hasCancellationCollision,
    hasExcessSettlementCollision,
    excess,
    receivedTipAmount,
    paymentMethodKinds,
  } = derivePaymentDetailState({ payment, reconciliations, now })
  const isPending = paymentStatus === "pending"

  const handleConfirmPaidDespiteCancellation = async () => {
    if (
      !(await require("sell", "access.action.confirmPaidDespiteCancellation"))
    )
      return
    setResolvePending(true)
    await runToast(async (run) => {
      const result = await run(confirmPaymentPaidDespiteCancellation(paymentId))
      if (!result.ok) return "paymentDetail.collision.markPaid.error"
    })
    setResolvePending(false)
  }

  const handleAcknowledgeExcessSettlement = async () => {
    if (!(await require("refund", "access.action.acknowledgeExcess"))) return
    setExcessResolvePending(true)
    await runToast(async (run) => {
      const result = await run(acknowledgePaymentExcessSettlement(paymentId))
      if (!result.ok) return "paymentDetail.excessCollision.acknowledge.error"
    })
    setExcessResolvePending(false)
  }

  // The refund screen asks for `refund` itself (access/0002); a part of the
  // payment starts on the money that came in on top (refund/0005).
  const handleRefund = () => {
    void navigate({
      to: "/activity/$paymentId/refund",
      params: { paymentId },
      search: { choice: "part" },
    })
  }
  return (
    <div className="flex flex-col gap-4">
      {isPending ? (
        <div className="flex flex-col gap-1">
          <Button
            className="h-12"
            nativeButton={false}
            render={<Link to="/payment/$paymentId" params={{ paymentId }} />}
          >
            {t("paymentDetail.backToPayment")}
          </Button>
          {payment.expiresAt === null ? null : (
            <p className="text-center text-xs text-muted-foreground">
              {t("paymentDetail.expiresAt", {
                time: formatTime(new Date(payment.expiresAt), locale),
              })}
            </p>
          )}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          {paymentNumber ? (
            <CardTitle>
              {t("paymentDetail.number", {
                number: paymentNumber.serialNumber,
              })}
            </CardTitle>
          ) : null}
          <CardDescription>
            {formatDateTime(new Date(payment.createdAt), locale)}
          </CardDescription>
          <CardAction>
            <Badge
              variant={
                paymentStatus === "canceled" ? "destructive" : "secondary"
              }
              className={cn(paymentStatusBadgeClassName[paymentStatus])}
            >
              {t(paymentStatusLabelKey[paymentStatus])}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <strong className="text-4xl font-semibold tracking-tight tabular-nums">
              {formatMoney(
                {
                  value: payment.amount,
                  currency: payment.currency,
                },
                locale
              )}
            </strong>
            {payment.cashReceivedAmount === null ||
            payment.cashReceivedAmount === payment.amount ? null : (
              <span className="text-sm text-muted-foreground">
                {t("paymentDetail.cashReceived", {
                  amount: formatMoney(
                    {
                      value: payment.cashReceivedAmount,
                      currency: payment.currency,
                    },
                    locale
                  ),
                })}
              </span>
            )}
            {receivedTipAmount > 0 ? (
              <span className="text-sm text-muted-foreground">
                {t("paymentDetail.tipIncluded", {
                  amount: formatMoney(
                    { value: receivedTipAmount, currency: payment.currency },
                    locale
                  ),
                })}
              </span>
            ) : null}
            {paymentMethodKinds.length > 0 ? (
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium">
                {paymentMethodKinds.map((kind) => {
                  const Icon = paymentMethodIcon[kind]
                  return (
                    <span key={kind} className="inline-flex items-center gap-1">
                      <Icon aria-hidden className="size-4" />
                      {kind === "qerkoTerminal" && qerkoTerminalTid !== null
                        ? t("paymentDetail.paymentMethod.qerkoTerminalTid", {
                            tid: qerkoTerminalTid,
                          })
                        : t(paymentMethodLabelKey[kind])}
                    </span>
                  )
                })}
              </span>
            ) : null}
            <PaymentQerkoAttempts paymentId={paymentId} />
            {payment.canceledAt === null ? null : (
              <span className="text-sm text-muted-foreground">
                {t("paymentDetail.canceledAtValue", {
                  date: formatDateTime(new Date(payment.canceledAt), locale),
                })}
              </span>
            )}
          </div>

          {hasCancellationCollision ? (
            <CollisionAlert
              title={t("paymentDetail.collision.title")}
              description={t("paymentDetail.collision.description")}
            >
              <Button
                className="h-12 flex-1"
                disabled={resolvePending}
                onClick={() => void handleConfirmPaidDespiteCancellation()}
              >
                {t("paymentDetail.collision.markPaid")}
              </Button>
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={handleRefund}
              >
                {t("paymentDetail.collision.refund")}
              </Button>
            </CollisionAlert>
          ) : null}

          {hasExcessSettlementCollision ? (
            <CollisionAlert
              title={t("paymentDetail.excessCollision.title")}
              description={t("paymentDetail.excessCollision.description")}
            >
              <Button
                className="h-12 flex-1"
                disabled={excessResolvePending}
                onClick={() => void handleAcknowledgeExcessSettlement()}
              >
                {t("paymentDetail.excessCollision.acknowledge")}
              </Button>
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={handleRefund}
              >
                {t("paymentDetail.collision.refund")}
              </Button>
            </CollisionAlert>
          ) : null}
        </CardContent>
      </Card>

      <PaymentDetailRefunds
        payment={payment}
        excess={excess}
        isPaid={paymentStatus === "paid"}
        paymentMethodKinds={paymentMethodKinds}
      />

      {payment.billId !== null ? (
        <PaymentDetailBillCard
          billId={payment.billId}
          paymentId={paymentId}
          tipAmount={payment.tipAmount}
        />
      ) : null}

      <PaymentDetailEetCards paymentId={paymentId} />

      <Card>
        <CardHeader>
          <CardTitle>{t("paymentDetail.reconciliations")}</CardTitle>
        </CardHeader>
        <CardContent>
          {reconciliations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("paymentDetail.reconciliations.empty")}
            </p>
          ) : (
            <Timeline value={reconciliations.length}>
              {reconciliations.map((reconciliation, index) => (
                <TimelineItem key={reconciliation.id} step={index + 1}>
                  <TimelineHeader>
                    <TimelineDate>
                      {formatDateTime(
                        new Date(reconciliation.claimedAt),
                        locale
                      )}
                    </TimelineDate>
                    <TimelineTitle className="flex items-center gap-2">
                      {t(paymentMethodLabelKey[reconciliation.transactionKind])}
                      <Badge variant="secondary">
                        {t(claimSourceLabelKey[reconciliation.source])}
                      </Badge>
                    </TimelineTitle>
                  </TimelineHeader>
                  <TimelineIndicator />
                  <TimelineSeparator />
                  <TimelineContent>
                    <div className="mt-2 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
                      <DetailRow
                        label={t("paymentDetail.transaction.amount")}
                        value={formatMoney(
                          {
                            value: reconciliation.transactionAmount,
                            currency: reconciliation.transactionCurrency,
                          },
                          locale
                        )}
                        emphasize
                      />
                      <PaymentDetailOptionalRow
                        label={t("paymentDetail.transaction.account")}
                        value={
                          reconciliation.accountName ?? reconciliation.accountId
                        }
                      />
                      <PaymentDetailOptionalRow
                        label={t("paymentDetail.transaction.variableSymbol")}
                        value={reconciliation.variableSymbol}
                      />
                      <PaymentDetailOptionalRow
                        label={t("paymentDetail.transaction.note")}
                        value={reconciliation.transactionNote}
                      />
                      <PaymentDetailTechnical>
                        <DetailRow
                          label={t("paymentDetail.transaction.occurredAt")}
                          value={formatDateTime(
                            new Date(reconciliation.transactionOccurredAt),
                            locale
                          )}
                        />
                        {reconciliation.transactionRecordedAt ===
                        null ? null : (
                          <DetailRow
                            label={t("paymentDetail.transaction.recordedAt")}
                            value={formatDateTime(
                              new Date(reconciliation.transactionRecordedAt),
                              locale
                            )}
                          />
                        )}
                        {reconciliation.transactionSource === null ? null : (
                          <DetailRow
                            label={t("paymentDetail.transaction.source")}
                            value={t(
                              claimSourceLabelKey[
                                reconciliation.transactionSource
                              ]
                            )}
                          />
                        )}
                        <PaymentDetailCopyRow
                          label={t("paymentDetail.transaction.id")}
                          value={reconciliation.accountTransactionId}
                        />
                        <PaymentDetailCopyRow
                          label={t("paymentDetail.transaction.bankReference")}
                          value={reconciliation.bankReference}
                        />
                        <PaymentDetailCopyRow
                          label={t("paymentDetail.transaction.sparkTransferId")}
                          value={reconciliation.sparkTransferId}
                        />
                        <PaymentDetailCopyRow
                          label={t("paymentDetail.transaction.paymentHash")}
                          value={reconciliation.paymentHash}
                        />
                        <PaymentDetailCopyRow
                          label={t("paymentDetail.transaction.preimage")}
                          value={reconciliation.preimage}
                        />
                        <PaymentDetailCopyRow
                          label={t("paymentDetail.reconciliation.id")}
                          value={reconciliation.id}
                        />
                      </PaymentDetailTechnical>
                    </div>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </CardContent>
      </Card>

      <PaymentDetailTechnical>
        <PaymentDetailCopyRow
          label={t("paymentDetail.id")}
          value={payment.id}
        />
        <PaymentDetailCopyRow
          label={t("paymentDetail.deviceId")}
          value={payment.deviceId}
        />
        {payment.updatedAt === null ? null : (
          <DetailRow
            label={t("paymentDetail.updatedAt")}
            value={formatDateTime(new Date(payment.updatedAt), locale)}
          />
        )}
      </PaymentDetailTechnical>
    </div>
  )
}

function PaymentDetailBillCard({
  billId,
  paymentId,
  tipAmount,
}: {
  readonly billId: BillId
  readonly paymentId: PaymentId
  readonly tipAmount: NonNegativeInteger
}) {
  usePreloadEvoluQueries([
    ...billStateQueries(billId),
    ...billLineSummaryDiffQueries(paymentId),
    tablesQuery,
    taxRatesQuery,
    claimedPaymentsByBillIdQuery(billId),
  ])
  const { t } = useTranslation()
  const locale = useLocale()
  const query = billByIdQuery(billId)
  const { data: bills } = useEvoluQuery(query)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)
  const summaries = useBillLineSummaries(billId)
  const billStatus = useBillStatus(billId)
  const { claimedSum, coverage } = useBillCoverage(billId)
  const lineDiff = useBillLineSummaryDiff(paymentId, billId)
  const frozenLines = usePaymentLineSummaries(paymentId)
  const claimedPaymentsQuery = claimedPaymentsByBillIdQuery(billId)
  const { data: claimedPayments } = useEvoluQuery(claimedPaymentsQuery)
  const bill = bills[0]

  if (!bill || billStatus === undefined) {
    return null
  }

  const table = tables.find((candidate) => candidate.id === bill.tableId)
  const totalAmount = deriveBillSummaryTotal(summaries)
  // Bill total plus this payment's tip, so the items list's own total
  // reconciles with `payment.amount` (see `calculatePaymentAmounts`) — kept
  // separate from `totalAmount`, which the coverage math below compares
  // against `claimedSum` (also tip-excluded, see `calculateClaimedSum`).
  const totalAmountWithTip = Integer(totalAmount + tipAmount)

  const otherClaimedPaymentIds = [
    ...new Set(claimedPayments.map((payment) => payment.id)),
  ].filter((id) => id !== paymentId)
  const {
    warning: coverageWarning,
    reason: coverageMismatchReason,
    hasLineDiff,
  } = derivePaymentBillCoverageNotice({
    coverage,
    claimedSum,
    lineDiff,
    otherClaimedPaymentCount: otherClaimedPaymentIds.length,
  })
  // The VAT this payment was made with: its frozen lines and their frozen
  // discount shares (catalog/0003). A payment from before the snapshot has
  // none, and falls back to the bill's live lines.
  const taxRecapRows = calculateTaxRecap(
    frozenLines ?? allocateDiscount(summaries),
    taxRates
  )
  const hasTaxRecap = hasTaxableLines(taxRecapRows)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("paymentDetail.bill.title")}</CardTitle>
        <CardDescription>
          {bill.label ?? t("bill.list.label", { number: bill.displayNumber })}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/activity/bills/$billId" params={{ billId }} />}
          >
            {t("paymentDetail.bill.open")}
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              {t("paymentDetail.bill.table")}
            </span>
            {/*
             * Spelled out rather than "—": a counter sale with no table is a
             * fact staff should read, not a missing value. "—" stays for a
             * tableId whose table row is gone (deleted since).
             */}
            <span
              className={cn(
                "text-sm font-medium",
                bill.tableId === null && "text-muted-foreground"
              )}
            >
              {bill.tableId === null
                ? t("paymentDetail.bill.noTable")
                : (table?.name ?? t("paymentDetail.emptyValue"))}
            </span>
          </div>
          <Badge
            variant={
              billStatus.status === "canceled" ? "destructive" : "secondary"
            }
            className={cn(billStatusBadgeClassName[billStatus.status])}
          >
            {t(billStatusLabelKey[billStatus.status])}
          </Badge>
        </div>

        {billStatus.hasCancellationCollision ? (
          <BillCancellationCollisionPanel billId={billId} />
        ) : null}

        <Separator />

        {summaries.length === 0 && tipAmount === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("paymentDetail.bill.empty")}
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {summaries.map((summary) => (
              <div
                key={summary.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{summary.name}</p>
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
                </div>
                <p className="text-sm font-semibold">
                  {formatMoney(
                    { value: summary.totalAmount, currency: summary.currency },
                    locale
                  )}
                </p>
              </div>
            ))}
            {tipAmount > 0 ? (
              <div className="flex items-center justify-between gap-2 py-2">
                <p className="text-sm font-medium">
                  {t("paymentDetail.tipAmount")}
                </p>
                <p className="text-sm font-semibold">
                  {formatMoney(
                    { value: tipAmount, currency: bill.currency },
                    locale
                  )}
                </p>
              </div>
            ) : null}
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

        <Separator />

        <DetailRow
          label={t("paymentDetail.bill.total")}
          value={formatMoney(
            { value: totalAmountWithTip, currency: bill.currency },
            locale
          )}
          emphasize
        />

        {coverageWarning === null ? null : (
          <BillCoverageWarning
            coverage={coverageWarning}
            expectedAmount={totalAmount}
            claimedSum={claimedSum}
            currency={bill.currency}
            reason={coverageMismatchReason}
          >
            {coverageMismatchReason === "multiplePayments" ? (
              <div className="flex w-full flex-col gap-2 border-t border-warning/30 pt-2">
                {otherClaimedPaymentIds.map((otherPaymentId, index) => (
                  <Button
                    key={otherPaymentId}
                    variant="outline"
                    nativeButton={false}
                    render={
                      <Link
                        to="/activity/$paymentId"
                        params={{ paymentId: otherPaymentId }}
                      />
                    }
                  >
                    {otherClaimedPaymentIds.length > 1
                      ? t("bill.collision.viewPayment.numbered", {
                          number: index + 1,
                        })
                      : t("bill.collision.viewPayment")}
                  </Button>
                ))}
              </div>
            ) : null}

            {hasLineDiff ? (
              <div className="flex w-full flex-col gap-1 border-t border-warning/30 pt-2">
                <span className="font-medium text-foreground">
                  {t("paymentDetail.bill.coverage.changesTitle")}
                </span>
                {lineDiff?.removed.map((summary) => (
                  <div
                    key={summary.id}
                    className="flex w-full items-center justify-between gap-4"
                  >
                    <span>
                      − {summary.quantity} × {summary.name}
                    </span>
                    <span>
                      {formatMoney(
                        {
                          value: summary.totalAmount,
                          currency: summary.currency,
                        },
                        locale
                      )}
                    </span>
                  </div>
                ))}
                {lineDiff?.added.map((summary) => (
                  <div
                    key={summary.id}
                    className="flex w-full items-center justify-between gap-4"
                  >
                    <span>
                      + {summary.quantity} × {summary.name}
                    </span>
                    <span>
                      {formatMoney(
                        {
                          value: summary.totalAmount,
                          currency: summary.currency,
                        },
                        locale
                      )}
                    </span>
                  </div>
                ))}
                {lineDiff?.changed.map(({ before, after }) => (
                  <div
                    key={after.id}
                    className="flex w-full items-center justify-between gap-4"
                  >
                    <span>{after.name}</span>
                    <span>
                      {formatMoney(
                        {
                          value: before.totalAmount,
                          currency: before.currency,
                        },
                        locale
                      )}
                      {" → "}
                      {formatMoney(
                        {
                          value: after.totalAmount,
                          currency: after.currency,
                        },
                        locale
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </BillCoverageWarning>
        )}
      </CardContent>
    </Card>
  )
}

type PaymentDetailEetSale = InferRow<
  ReturnType<typeof eetSalesByPaymentIdQuery>
>

const retryErrorKeys = {
  EetSaleNotFoundError: "paymentDetail.eet.retry.failed",
  EetSaleAlreadyConfirmedError: "paymentDetail.eet.retry.alreadyConfirmed",
  EetSaleUnsupportedError: "paymentDetail.eet.retry.unsupported",
  EetSaleBusyError: "paymentDetail.eet.retry.busy",
  EetSigningCertificateMissingError: "paymentDetail.eet.retry.noCertificate",
} satisfies Record<DeliverEetSaleError["type"], TranslationKey>

const retryOutcomeKeys = {
  accepted: "paymentDetail.eet.retry.confirmed",
  verified: "paymentDetail.eet.retry.confirmed",
  retry: "paymentDetail.eet.retry.pending",
  rejected: "paymentDetail.eet.retry.rejected",
} satisfies Record<EetDeliveryOutcome["type"], TranslationKey>

function PaymentDetailEetCards({
  paymentId,
}: {
  readonly paymentId: PaymentId
}) {
  const sales = useEvoluQuery(eetSalesByPaymentIdQuery(paymentId)).data

  return sales.map((sale) => (
    <PaymentDetailEetSaleCard key={sale.id} sale={sale} />
  ))
}

function PaymentDetailEetSaleCard({
  sale,
}: {
  readonly sale: PaymentDetailEetSale
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const [retrying, setRetrying] = useState(false)
  const deviceId = useAtomValue(accountAtom).device.id
  const { status, isOverdue } = useEetSaleStatus(sale)
  const isExtraMoney = sale.extraFrom !== null
  const waitEndsAt = useEetRecordingDeviceWait({
    attempts: sale,
    recordingDeviceId: sale.deviceId,
    deviceId,
    startsAt: parseEetDateTime(sale.saleAt),
  })
  const warnings =
    sale.warningsJson === null ? [] : parseEetWarnings(sale.warningsJson)
  const canRetry =
    (status === "pending" || status === "rejected") && waitEndsAt === null
  const lastError =
    sale.pok !== null || sale.lastErrorMessage === null
      ? null
      : sale.lastErrorCode === null
        ? sale.lastErrorMessage
        : t("paymentDetail.eet.errorCode", {
            code: String(sale.lastErrorCode),
            message: sale.lastErrorMessage,
          })

  const retry = async () => {
    setRetrying(true)
    await runToast(async (run) => {
      const result = await run(retryEetSale({ id: sale.id, deviceId }))
      if (!result.ok) return retryErrorKeys[result.error.type]
      const outcomeKey = retryOutcomeKeys[result.value.type]
      if (result.value.type === "rejected") return outcomeKey
      toast.success(t(outcomeKey))
      return undefined
    })
    setRetrying(false)
  }

  return (
    <Card
      data-testid={
        isExtraMoney ? "payment-detail-eet-extra" : "payment-detail-eet"
      }
    >
      <CardHeader>
        <CardTitle>
          {isExtraMoney
            ? t("paymentDetail.eet.extra.title", {
                amount: formatMoney(
                  { value: sale.amount, currency: sale.currency },
                  locale
                ),
              })
            : t("paymentDetail.eet.title")}
        </CardTitle>
        <CardAction>
          <EetSaleStatusBadge sale={sale} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isExtraMoney ? (
          <p className="text-sm text-muted-foreground">
            {t("paymentDetail.eet.extra.description")}
          </p>
        ) : null}
        {status === "testConfirmed" || sale.environment === "playground" ? (
          <p className="text-xs text-info">{t("paymentDetail.eet.test")}</p>
        ) : null}
        {isOverdue ? (
          <p className="text-sm text-destructive">
            {t("paymentDetail.eet.overdue")}
          </p>
        ) : null}
        {status === "unsupported" ? (
          <p className="text-sm text-destructive">
            {t("paymentDetail.eet.unsupported")}
          </p>
        ) : null}
        {waitEndsAt === null ? null : (
          <p className="text-sm text-muted-foreground">
            {t("paymentDetail.eet.waitingForDevice", {
              time: formatTime(new Date(waitEndsAt), locale),
            })}
          </p>
        )}
        <DetailRow
          label={t("paymentDetail.eet.amount")}
          value={formatMoney(
            { value: sale.amount, currency: sale.currency },
            locale
          )}
        />
        <PaymentDetailCopyRow
          label={t("paymentDetail.eet.pok")}
          value={sale.pok}
        />
        {sale.receivedAt === null ? null : (
          <DetailRow
            label={t("paymentDetail.eet.receivedAt")}
            value={formatDateTime(parseISO(sale.receivedAt), locale)}
          />
        )}
        {warnings.map((warning) => (
          <DetailRow
            key={warning.code}
            label={t("paymentDetail.eet.warning", {
              code: String(warning.code),
            })}
            value={warning.message ?? ""}
          />
        ))}
        {lastError === null ? null : (
          <DetailRow
            label={t("paymentDetail.eet.lastError")}
            value={lastError}
          />
        )}
        {canRetry ? (
          <Button
            type="button"
            variant="outline"
            className="h-12"
            disabled={retrying}
            onClick={() => void retry()}
          >
            <RotateCwIcon data-icon="inline-start" />
            {t("paymentDetail.eet.retry")}
          </Button>
        ) : null}
        <PaymentDetailTechnical>
          <DetailRow
            label={t("paymentDetail.eet.saleAt")}
            value={formatDateTime(parseISO(sale.saleAt), locale)}
          />
          <DetailRow label={t("paymentDetail.eet.eic")} value={sale.eic} />
          <DetailRow
            label={t("paymentDetail.eet.establishment")}
            value={sale.establishmentId}
          />
          <PaymentDetailCopyRow
            label={t("paymentDetail.eet.cashRegister")}
            value={sale.cashRegisterId}
          />
          <PaymentDetailCopyRow
            label={t("paymentDetail.eet.sequenceNumber")}
            value={sale.sequenceNumber}
          />
          <PaymentDetailCopyRow
            label={t("paymentDetail.eet.transactionId")}
            value={sale.globalTransactionId ?? sale.lastGlobalTransactionId}
          />
        </PaymentDetailTechnical>
      </CardContent>
    </Card>
  )
}

/** Identifiers and bookkeeping timestamps staff rarely need, collapsed by default. */
export function PaymentDetailTechnical({
  children,
}: {
  readonly children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {t("paymentDetail.technical")}
        <ChevronDownIcon
          aria-hidden
          className="size-3.5 transition-transform group-data-panel-open:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function PaymentDetailCopyRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | null
}) {
  const { t } = useTranslation()

  if (value === null) return null

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-mono text-xs">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("paymentDetail.copy", { label })}
          onClick={() =>
            void copyToClipboard(value, {
              copied: t("paymentDetail.copied"),
              failed: t("paymentDetail.copyError"),
            })
          }
        >
          <CopyIcon />
        </Button>
      </span>
    </div>
  )
}

function PaymentDetailOptionalRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | null
}) {
  if (value === null) return null

  return <DetailRow label={label} value={value} />
}
