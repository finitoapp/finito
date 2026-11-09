import type { InferRow } from "@evolu/common"
import {
  type BillCoverageMismatchReason,
  derivePaymentBillCoverageNotice,
  derivePaymentDetailState,
} from "@payky/app-shared/activity-detail"
import {
  billStatusLabelKey,
  paymentMethodLabelKey,
  paymentStatusLabelKey,
} from "@payky/app-shared/activity-labels"
import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useNow } from "@payky/app-shared/use-now"
import type { EetDeliveryOutcome } from "@payky/core/integrations/eet/eet-client"
import { claimedPaymentsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  calculateTaxRecap,
  hasTaxableLines,
} from "@payky/core/modules/bill-line/bill-line-tax-utils"
import { deriveBillSummaryTotal } from "@payky/core/modules/bill-line/bill-line-utils"
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
  paymentDetailQuery,
  paymentQerkoTerminalByIdQuery,
  paymentReconciliationsQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "@payky/core/modules/payment/payment-queries"
import { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentNumberByPaymentIdQuery } from "@payky/core/modules/payment-number/payment-number-queries"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { parseISO } from "date-fns"
import { router, useLocalSearchParams } from "expo-router"
import { useAtomValue } from "jotai"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import { Suspense, useMemo, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { AmountFigure } from "../../components/amount-figure.tsx"
import { CollisionAlert } from "../../components/collision-alert.tsx"
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
import { Icon } from "../../components/ui/icon.tsx"
import { Separator } from "../../components/ui/separator.tsx"
import { Skeleton } from "../../components/ui/skeleton.tsx"
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "../../components/ui/timeline.tsx"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney, formatMoneyParts } from "../../lib/format-money.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"
import { BillCancellationCollisionActions } from "../shared/bill-cancellation-collision-actions.tsx"
import {
  EetSaleStatusLabel,
  useEetRecordingDeviceWait,
  useEetSaleStatus,
} from "../shared/eet-sale-status.tsx"
import { paymentMethodIcon } from "../shared/payment-method-display.ts"
import { TaxRecap } from "../shared/tax-recap.tsx"
import {
  billStateQueries,
  useBillLineSummaries,
  useBillStatus,
} from "../shared/use-bill-state.ts"
import { BillStatusBadge } from "./bill-status-display.tsx"
import {
  BillCoverageWarning,
  BillLines,
  DetailScreen,
  OptionalRow,
  Technical,
} from "./detail-parts.tsx"
import { PaymentQerkoAttempts } from "./payment-qerko-attempts.tsx"
import { PaymentRefunds } from "./payment-refunds.tsx"
import { PaymentStatusBadge } from "./payment-status-display.tsx"
import {
  billLineSummaryDiffQueries,
  useBillCoverage,
  useBillLineSummaryDiff,
} from "./use-bill-detail-data.ts"
import { usePaymentCollisionActions } from "./use-payment-collision-actions.ts"
import { paymentRefundsQueries } from "./use-payment-refund-state.ts"

const claimSourceLabelKey = {
  auto: "paymentDetail.reconciliation.source.auto",
  manual: "paymentDetail.reconciliation.source.manual",
} as const satisfies Record<"auto" | "manual", TranslationKey>

/** `/activity/[paymentId]`: one payment, read-only. */
export function PaymentDetailPage() {
  const { t } = useTranslation()
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>()
  const parsed = PaymentId.safeParse(paymentId)

  return (
    <DetailScreen title={t("paymentDetail.title")}>
      {parsed.success ? (
        <Suspense fallback={<PaymentDetailSkeleton />}>
          <PaymentDetail paymentId={parsed.data} />
        </Suspense>
      ) : (
        <NotFoundCard messageKey="paymentDetail.invalidId" />
      )}
    </DetailScreen>
  )
}

/** Web's `PaymentDetailSkeleton`: the summary and bill cards' outlines. */
export function PaymentDetailSkeleton() {
  return (
    <YStack gap={16}>
      <Skeleton w="100%" h={160} rounded={radius.xl} />
      <Skeleton w="100%" h={112} rounded={radius.xl} />
    </YStack>
  )
}

function PaymentDetail({ paymentId }: { readonly paymentId: PaymentId }) {
  // This card's queries and those of the cards below that need only the
  // payment's id; `PaymentBillCard` preloads its own once the bill id is read.
  usePreloadEvoluQueries(
    useMemo(
      () => [
        paymentDetailQuery(paymentId),
        paymentReconciliationsQuery(paymentId),
        paymentNumberByPaymentIdQuery(paymentId),
        eetSalesByPaymentIdQuery(paymentId),
        qerkoPaymentAttemptsByPaymentIdQuery(paymentId),
        ...paymentRefundsQueries(paymentId),
      ],
      [paymentId]
    )
  )
  const { t } = useTranslation()
  const locale = useLocale()
  const [payment] = useEvoluQuery(paymentDetailQuery(paymentId)).data
  // The terminal's TID tells staff which one took the card (qerko/0006).
  const qerkoTerminalTid =
    useEvoluQuery(paymentQerkoTerminalByIdQuery(paymentId)).data[0]
      ?.terminalTid ?? null
  const reconciliations = useEvoluQuery(
    paymentReconciliationsQuery(paymentId)
  ).data
  const [paymentNumber] = useEvoluQuery(
    paymentNumberByPaymentIdQuery(paymentId)
  ).data
  const collision = usePaymentCollisionActions(paymentId)
  // Nothing writes a row when a payment expires; see `useNow`.
  const now = useNow([payment?.expiresAt ?? null])

  // A deleted or never-synced id: the same page, not an error.
  if (payment === undefined)
    return <NotFoundCard messageKey="paymentDetail.notFound" />
  const headline = formatMoneyParts(
    { value: payment.amount, currency: payment.currency },
    locale
  )

  const {
    status,
    hasCancellationCollision,
    hasExcessSettlementCollision,
    excess,
    receivedTipAmount,
    paymentMethodKinds,
  } = derivePaymentDetailState({ payment, reconciliations, now })

  return (
    <YStack gap={16}>
      {status === "pending" ? (
        <YStack gap="1">
          <Button
            size="lg"
            label={t("paymentDetail.backToPayment")}
            onPress={() =>
              router.push({
                pathname: "/payment/[paymentId]",
                params: { paymentId },
              })
            }
          />
          {payment.expiresAt === null ? null : (
            <Text
              fontSize="xs"
              lineHeight="xs"
              color="muted-foreground"
              text="center"
            >
              {t("paymentDetail.expiresAt", {
                time: formatTime(new Date(payment.expiresAt), locale),
              })}
            </Text>
          )}
        </YStack>
      ) : null}

      <Card>
        <CardHeader>
          {paymentNumber === undefined ? null : (
            <CardTitle>
              {t("paymentDetail.number", {
                number: paymentNumber.serialNumber,
              })}
            </CardTitle>
          )}
          <CardDescription>
            {formatDateTime(new Date(payment.createdAt), locale)}
          </CardDescription>
          <CardAction>
            <PaymentStatusBadge
              status={status}
              label={t(paymentStatusLabelKey[status])}
            />
          </CardAction>
        </CardHeader>
        <CardContent gap={12}>
          <YStack gap={4}>
            <AmountFigure
              align="start"
              number={headline.number}
              unit={headline.unit}
              unitFirst={headline.unitFirst}
              label={headline.text}
            />
            {payment.cashReceivedAmount === null ||
            payment.cashReceivedAmount === payment.amount ? null : (
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {t("paymentDetail.cashReceived", {
                  amount: formatMoney(
                    {
                      value: payment.cashReceivedAmount,
                      currency: payment.currency,
                    },
                    locale
                  ),
                })}
              </Text>
            )}
            {receivedTipAmount > 0 ? (
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {t("paymentDetail.tipIncluded", {
                  amount: formatMoney(
                    { value: receivedTipAmount, currency: payment.currency },
                    locale
                  ),
                })}
              </Text>
            ) : null}
            {paymentMethodKinds.length > 0 ? (
              <XStack flexWrap="wrap" gap={12} rowGap={4}>
                {paymentMethodKinds.map((kind) => (
                  <XStack key={kind} items="center" gap={4}>
                    <Icon icon={paymentMethodIcon[kind]} />
                    <Text
                      fontSize={fontSize.sm}
                      lineHeight={fontSize.sm}
                      fontWeight={fontWeight.medium}
                    >
                      {kind === "qerkoTerminal" && qerkoTerminalTid !== null
                        ? t("paymentDetail.paymentMethod.qerkoTerminalTid", {
                            tid: qerkoTerminalTid,
                          })
                        : t(paymentMethodLabelKey[kind])}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            ) : null}
            <PaymentQerkoAttempts paymentId={paymentId} />
            {payment.canceledAt === null ? null : (
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {t("paymentDetail.canceledAtValue", {
                  date: formatDateTime(new Date(payment.canceledAt), locale),
                })}
              </Text>
            )}
          </YStack>

          {hasCancellationCollision ? (
            <CollisionAlert
              title={t("paymentDetail.collision.title")}
              description={t("paymentDetail.collision.description")}
            >
              <Button
                size="lg"
                label={t("paymentDetail.collision.markPaid")}
                pending={collision.resolvePending}
                onPress={() => void collision.confirmPaid()}
              />
              <Button
                size="lg"
                variant="outline"
                label={t("paymentDetail.collision.refund")}
                onPress={collision.refund}
              />
            </CollisionAlert>
          ) : null}
          {hasExcessSettlementCollision ? (
            <CollisionAlert
              title={t("paymentDetail.excessCollision.title")}
              description={t("paymentDetail.excessCollision.description")}
            >
              <Button
                size="lg"
                label={t("paymentDetail.excessCollision.acknowledge")}
                pending={collision.excessResolvePending}
                onPress={() => void collision.acknowledgeExcess()}
              />
              <Button
                size="lg"
                variant="outline"
                label={t("paymentDetail.collision.refund")}
                onPress={collision.refund}
              />
            </CollisionAlert>
          ) : null}
        </CardContent>
      </Card>

      <PaymentRefunds
        payment={payment}
        excess={excess}
        isPaid={status === "paid"}
        paymentMethodKinds={paymentMethodKinds}
      />

      {payment.billId === null ? null : (
        <PaymentBillCard
          billId={payment.billId}
          paymentId={paymentId}
          tipAmount={payment.tipAmount}
        />
      )}

      <PaymentEetCards paymentId={paymentId} />

      <Card>
        <CardHeader>
          <CardTitle>{t("paymentDetail.reconciliations")}</CardTitle>
        </CardHeader>
        <CardContent gap={12}>
          {reconciliations.length === 0 ? (
            <Text color="muted-foreground">
              {t("paymentDetail.reconciliations.empty")}
            </Text>
          ) : (
            <Timeline value={reconciliations.length}>
              {reconciliations.map((reconciliation, index) => (
                <TimelineItem
                  key={reconciliation.id}
                  step={index + 1}
                  last={index === reconciliations.length - 1}
                >
                  <TimelineHeader>
                    <TimelineDate>
                      {formatDateTime(
                        new Date(reconciliation.claimedAt),
                        locale
                      )}
                    </TimelineDate>
                    <TimelineTitle>
                      {t(paymentMethodLabelKey[reconciliation.transactionKind])}
                      <Badge
                        variant="secondary"
                        label={t(claimSourceLabelKey[reconciliation.source])}
                      />
                    </TimelineTitle>
                  </TimelineHeader>
                  <TimelineIndicator />
                  <TimelineSeparator />
                  <TimelineContent>
                    <YStack mt={8} gap={8} rounded={8.8} bg="muted-20" p={12}>
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
                      <OptionalRow
                        label={t("paymentDetail.transaction.account")}
                        value={
                          reconciliation.accountName ?? reconciliation.accountId
                        }
                      />
                      <OptionalRow
                        label={t("paymentDetail.transaction.variableSymbol")}
                        value={reconciliation.variableSymbol}
                      />
                      <OptionalRow
                        label={t("paymentDetail.transaction.note")}
                        value={reconciliation.transactionNote}
                      />
                      <Technical>
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
                        <OptionalRow
                          mono
                          label={t("paymentDetail.transaction.id")}
                          value={reconciliation.accountTransactionId}
                        />
                        <OptionalRow
                          mono
                          label={t("paymentDetail.transaction.bankReference")}
                          value={reconciliation.bankReference}
                        />
                        <OptionalRow
                          mono
                          label={t("paymentDetail.transaction.sparkTransferId")}
                          value={reconciliation.sparkTransferId}
                        />
                        <OptionalRow
                          mono
                          label={t("paymentDetail.transaction.paymentHash")}
                          value={reconciliation.paymentHash}
                        />
                        <OptionalRow
                          mono
                          label={t("paymentDetail.transaction.preimage")}
                          value={reconciliation.preimage}
                        />
                        <OptionalRow
                          mono
                          label={t("paymentDetail.reconciliation.id")}
                          value={reconciliation.id}
                        />
                      </Technical>
                    </YStack>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </CardContent>
      </Card>

      <Technical>
        <OptionalRow mono label={t("paymentDetail.id")} value={payment.id} />
        <OptionalRow
          mono
          label={t("paymentDetail.deviceId")}
          value={payment.deviceId}
        />
        {payment.updatedAt === null ? null : (
          <DetailRow
            label={t("paymentDetail.updatedAt")}
            value={formatDateTime(new Date(payment.updatedAt), locale)}
          />
        )}
      </Technical>
    </YStack>
  )
}

function PaymentBillCard({
  billId,
  paymentId,
  tipAmount,
}: {
  readonly billId: BillId
  readonly paymentId: PaymentId
  readonly tipAmount: NonNegativeInteger
}) {
  usePreloadEvoluQueries(
    useMemo(
      () => [
        ...billStateQueries(billId),
        ...billLineSummaryDiffQueries(paymentId),
        tablesQuery,
        taxRatesQuery,
        claimedPaymentsByBillIdQuery(billId),
      ],
      [billId, paymentId]
    )
  )
  const { t } = useTranslation()
  const locale = useLocale()
  const [bill] = useEvoluQuery(billByIdQuery(billId)).data
  const tables = useEvoluQuery(tablesQuery).data
  const taxRates = useEvoluQuery(taxRatesQuery).data
  const summaries = useBillLineSummaries(billId)
  const billStatus = useBillStatus(billId)
  const { claimedSum, coverage } = useBillCoverage(billId)
  const lineDiff = useBillLineSummaryDiff(paymentId, billId)
  const claimedPayments = useEvoluQuery(
    claimedPaymentsByBillIdQuery(billId)
  ).data

  // The bill row is gone or still syncing: the payment stands without its card.
  if (bill === undefined || billStatus === undefined) return null

  const table = tables.find((candidate) => candidate.id === bill.tableId)
  const totalAmount = deriveBillSummaryTotal(summaries)
  // Bill total plus this payment's tip, so the items list reconciles with
  // `payment.amount`; kept apart from `totalAmount`, which coverage compares
  // against the (tip-excluded) `claimedSum`.
  const totalAmountWithTip = NonNegativeInteger(totalAmount + tipAmount)
  const otherClaimedPaymentIds = [
    ...new Set(claimedPayments.map((payment) => payment.id)),
  ].filter((id) => id !== paymentId)
  const notice = derivePaymentBillCoverageNotice({
    coverage,
    claimedSum,
    lineDiff,
    otherClaimedPaymentCount: otherClaimedPaymentIds.length,
  })
  const taxRecapRows = calculateTaxRecap(summaries, taxRates)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("paymentDetail.bill.title")}</CardTitle>
        <CardDescription>
          {bill.label ?? t("bill.list.label", { number: bill.displayNumber })}
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            variant="ghost"
            iconEnd={ChevronRight}
            label={t("paymentDetail.bill.open")}
            onPress={() =>
              router.push({
                pathname: "/activity/bills/[billId]",
                params: { billId },
              })
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent gap={12}>
        <XStack items="flex-start" justify="space-between" gap={16}>
          <YStack gap={4}>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
              color="muted-foreground"
            >
              {t("paymentDetail.bill.table")}
            </Text>
            {/* Spelled out: a counter sale with no table is a fact staff should read. */}
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
              color={bill.tableId === null ? "muted-foreground" : "color"}
            >
              {bill.tableId === null
                ? t("paymentDetail.bill.noTable")
                : (table?.name ?? t("paymentDetail.emptyValue"))}
            </Text>
          </YStack>
          <BillStatusBadge
            status={billStatus.status}
            label={t(billStatusLabelKey[billStatus.status])}
          />
        </XStack>

        {billStatus.hasCancellationCollision ? (
          <CollisionAlert
            title={t("bill.collision.title")}
            description={t("bill.collision.description")}
          >
            <BillCancellationCollisionActions billId={billId} />
          </CollisionAlert>
        ) : null}

        <Separator />

        <BillLines
          summaries={summaries}
          emptyMessage={t("paymentDetail.bill.empty")}
        />
        {tipAmount > 0 ? (
          <DetailRow
            label={t("paymentDetail.tipAmount")}
            value={formatMoney(
              { value: tipAmount, currency: bill.currency },
              locale
            )}
          />
        ) : null}
        {hasTaxableLines(taxRecapRows) ? (
          <>
            <Separator />
            <TaxRecap rows={taxRecapRows} currency={bill.currency} />
          </>
        ) : null}
        <Separator />
        <DetailRow
          emphasize
          label={t("paymentDetail.bill.total")}
          value={formatMoney(
            { value: totalAmountWithTip, currency: bill.currency },
            locale
          )}
        />

        {notice.warning === null ? null : (
          <BillCoverageWarning
            coverage={notice.warning}
            expectedAmount={totalAmount}
            claimedSum={claimedSum}
            currency={bill.currency}
            reason={notice.reason satisfies BillCoverageMismatchReason | null}
          >
            {notice.reason === "multiplePayments"
              ? otherClaimedPaymentIds.map((otherPaymentId, index) => (
                  <Button
                    size="lg"
                    key={otherPaymentId}
                    variant="outline"
                    label={
                      otherClaimedPaymentIds.length > 1
                        ? t("bill.collision.viewPayment.numbered", {
                            number: index + 1,
                          })
                        : t("bill.collision.viewPayment")
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/activity/[paymentId]",
                        params: { paymentId: otherPaymentId },
                      })
                    }
                  />
                ))
              : null}
            {notice.hasLineDiff && lineDiff !== null ? (
              <YStack gap="1">
                <Text fontWeight="600">
                  {t("paymentDetail.bill.coverage.changesTitle")}
                </Text>
                {lineDiff.removed.map((summary) => (
                  <DetailRow
                    key={summary.id}
                    label={`− ${summary.quantity} × ${summary.name}`}
                    value={formatMoney(
                      {
                        value: summary.totalAmount,
                        currency: summary.currency,
                      },
                      locale
                    )}
                  />
                ))}
                {lineDiff.added.map((summary) => (
                  <DetailRow
                    key={summary.id}
                    label={`+ ${summary.quantity} × ${summary.name}`}
                    value={formatMoney(
                      {
                        value: summary.totalAmount,
                        currency: summary.currency,
                      },
                      locale
                    )}
                  />
                ))}
                {lineDiff.changed.map(({ before, after }) => (
                  <DetailRow
                    key={after.id}
                    label={after.name}
                    value={`${formatMoney(
                      { value: before.totalAmount, currency: before.currency },
                      locale
                    )} → ${formatMoney(
                      { value: after.totalAmount, currency: after.currency },
                      locale
                    )}`}
                  />
                ))}
              </YStack>
            ) : null}
          </BillCoverageWarning>
        )}
      </CardContent>
    </Card>
  )
}

type PaymentEetSale = InferRow<ReturnType<typeof eetSalesByPaymentIdQuery>>

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

/** Web's `PaymentDetailEetCards`: one card per EET sale of the payment. */
function PaymentEetCards({ paymentId }: { readonly paymentId: PaymentId }) {
  const sales = useEvoluQuery(eetSalesByPaymentIdQuery(paymentId)).data
  return sales.map((sale) => <PaymentEetSaleCard key={sale.id} sale={sale} />)
}

/**
 * Web's `PaymentDetailEetSaleCard`: the sale's status, POK, warnings and last
 * error, with a manual resend while it is pending or refused and no other
 * device holds its priority.
 */
function PaymentEetSaleCard({ sale }: { readonly sale: PaymentEetSale }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const toast = useToast()
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
      testID={isExtraMoney ? "payment-detail-eet-extra" : "payment-detail-eet"}
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
          <EetSaleStatusLabel sale={sale} />
        </CardAction>
      </CardHeader>
      <CardContent gap={12}>
        {isExtraMoney ? (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("paymentDetail.eet.extra.description")}
          </Text>
        ) : null}
        {status === "testConfirmed" || sale.environment === "playground" ? (
          <Text fontSize={fontSize.xs} lineHeight={fontSize.xs} color="info">
            {t("paymentDetail.eet.test")}
          </Text>
        ) : null}
        {isOverdue ? (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="destructive"
          >
            {t("paymentDetail.eet.overdue")}
          </Text>
        ) : null}
        {status === "unsupported" ? (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="destructive"
          >
            {t("paymentDetail.eet.unsupported")}
          </Text>
        ) : null}
        {waitEndsAt === null ? null : (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("paymentDetail.eet.waitingForDevice", {
              time: formatTime(new Date(waitEndsAt), locale),
            })}
          </Text>
        )}
        <DetailRow
          label={t("paymentDetail.eet.amount")}
          value={formatMoney(
            { value: sale.amount, currency: sale.currency },
            locale
          )}
        />
        <OptionalRow label={t("paymentDetail.eet.pok")} value={sale.pok} mono />
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
            variant="outline"
            h={48}
            iconStart={RotateCw}
            label={t("paymentDetail.eet.retry")}
            pending={retrying}
            onPress={() => void retry()}
          />
        ) : null}
        <Technical>
          <DetailRow
            label={t("paymentDetail.eet.saleAt")}
            value={formatDateTime(parseISO(sale.saleAt), locale)}
          />
          <DetailRow label={t("paymentDetail.eet.eic")} value={sale.eic} />
          <DetailRow
            label={t("paymentDetail.eet.establishment")}
            value={sale.establishmentId}
          />
          <OptionalRow
            label={t("paymentDetail.eet.cashRegister")}
            value={sale.cashRegisterId}
            mono
          />
          <OptionalRow
            label={t("paymentDetail.eet.sequenceNumber")}
            value={sale.sequenceNumber}
            mono
          />
          <OptionalRow
            label={t("paymentDetail.eet.transactionId")}
            value={sale.globalTransactionId ?? sale.lastGlobalTransactionId}
            mono
          />
        </Technical>
      </CardContent>
    </Card>
  )
}
