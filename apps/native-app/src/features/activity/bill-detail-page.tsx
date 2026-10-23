import type { InferRow } from "@evolu/common"
import {
  billStatusLabelKey,
  paymentStatusLabelKey,
} from "@payky/app-shared/activity-labels"
import { formatDateTime } from "@payky/app-shared/format-date"
import { useNow } from "@payky/app-shared/use-now"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import { BillId } from "@payky/core/modules/bill/bill-types"
import {
  calculateTaxRecap,
  hasTaxableLines,
} from "@payky/core/modules/bill-line/bill-line-tax-utils"
import { deriveBillSummaryTotal } from "@payky/core/modules/bill-line/bill-line-utils"
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
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { sumSelfPayAllocationsByLineKey } from "@payky/core/modules/table-self-pay/table-self-pay-projection-utils"
import { selfPayAllocationsByBillIdQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { router, useLocalSearchParams } from "expo-router"
import { Suspense, useMemo } from "react"
import { Pressable } from "react-native"
import { Text, XStack, YStack } from "tamagui"
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
import { Separator } from "../../components/ui/separator.tsx"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney, formatMoneyParts } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { BillCancellationCollisionActions } from "../shared/bill-cancellation-collision-actions.tsx"
import { EetSaleStatusLabel } from "../shared/eet-sale-status.tsx"
import { RefundBadge } from "../shared/refund-badge.tsx"
import { TaxRecap } from "../shared/tax-recap.tsx"
import {
  billStateQueries,
  useBillLineSummaries,
  useBillStatus,
} from "../shared/use-bill-state.ts"
import { PaymentMethodIcons } from "./activity-parts.tsx"
import { BillStatusBadge } from "./bill-status-display.tsx"
import {
  BillCoverageWarning,
  BillLines,
  DetailScreen,
  OptionalRow,
  Technical,
} from "./detail-parts.tsx"
import { PaymentDetailSkeleton } from "./payment-detail-page.tsx"
import {
  PaymentStatusBadge,
  PaymentStatusIcon,
} from "./payment-status-display.tsx"
import { useBillCoverage } from "./use-bill-detail-data.ts"

type BillEetSale = InferRow<ReturnType<typeof eetSalesByBillIdQuery>>

type BillPaymentRow = InferRow<
  ReturnType<typeof paymentsWithClaimsByBillIdQuery>
>

/** `/activity/bills/[billId]`: one bill, read-only. */
export function BillDetailPage() {
  const { t } = useTranslation()
  const { billId } = useLocalSearchParams<{ billId: string }>()
  const parsed = BillId.safeParse(billId)

  return (
    <DetailScreen title={t("billDetail.title")}>
      {parsed.success ? (
        <Suspense fallback={<PaymentDetailSkeleton />}>
          <BillDetail billId={parsed.data} />
        </Suspense>
      ) : (
        <NotFoundCard messageKey="billDetail.invalidId" />
      )}
    </DetailScreen>
  )
}

function BillDetail({ billId }: { readonly billId: BillId }) {
  usePreloadEvoluQueries(
    useMemo(
      () => [
        ...billStateQueries(billId),
        tablesQuery,
        taxRatesQuery,
        paymentsWithClaimsByBillIdQuery(billId),
        refundSummariesByBillIdQuery(billId),
        eetSalesByBillIdQuery(billId),
      ],
      [billId]
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
  const payments = useEvoluQuery(paymentsWithClaimsByBillIdQuery(billId)).data
  const refunds = useEvoluQuery(refundSummariesByBillIdQuery(billId)).data
  const refundsByPayment = summarizeRefundsByPayment(refunds)
  const eetSales = useEvoluQuery(eetSalesByBillIdQuery(billId)).data
  const selfPayAllocated = sumSelfPayAllocationsByLineKey(
    useEvoluQuery(selfPayAllocationsByBillIdQuery(billId)).data
  )

  // A deleted or never-synced id: the same page, not an error.
  if (bill === undefined || billStatus === undefined)
    return <NotFoundCard messageKey="billDetail.notFound" />

  const table = tables.find((candidate) => candidate.id === bill.tableId)
  const totalAmount = deriveBillSummaryTotal(summaries)
  const headline = formatMoneyParts(
    { value: totalAmount, currency: bill.currency },
    locale
  )
  const taxRecapRows = calculateTaxRecap(summaries, taxRates)
  const closedOrCanceled =
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
    <YStack gap={16}>
      {billStatus.status === "open" ? (
        <Button
          size="lg"
          label={t("billDetail.backToBill")}
          onPress={() => router.push({ pathname: "/bill", params: { billId } })}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {bill.label ?? t("bill.list.label", { number: bill.displayNumber })}
          </CardTitle>
          <CardDescription>
            {formatDateTime(new Date(bill.createdAt), locale)}
          </CardDescription>
          <CardAction>
            <BillStatusBadge
              status={billStatus.status}
              label={t(billStatusLabelKey[billStatus.status])}
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
            {closedOrCanceled === null ? null : (
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {closedOrCanceled}
              </Text>
            )}
          </YStack>

          {/* Spelled out rather than "—": a counter sale with no table is a fact; "—" is a table row that is gone. */}
          <DetailRow label={t("billDetail.table")}>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
              color={bill.tableId === null ? "muted-foreground" : "color"}
            >
              {bill.tableId === null
                ? t("billDetail.noTable")
                : (table?.name ?? t("billDetail.emptyValue"))}
            </Text>
          </DetailRow>

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
            emptyMessage={t("billDetail.items.empty")}
            selfPayAllocated={selfPayAllocated}
          />
          {hasTaxableLines(taxRecapRows) ? (
            <>
              <Separator />
              <TaxRecap rows={taxRecapRows} currency={bill.currency} />
            </>
          ) : null}
          {coverage === "paid" ? null : (
            <>
              <Separator />
              <BillCoverageWarning
                coverage={coverage}
                expectedAmount={totalAmount}
                claimedSum={claimedSum}
                currency={bill.currency}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("billDetail.payments")}</CardTitle>
        </CardHeader>
        <CardContent gap={12}>
          {payments.length === 0 ? (
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >
              {t("billDetail.payments.empty")}
            </Text>
          ) : (
            <YStack>
              {payments.map((payment) => (
                <BillPaymentRowView
                  key={payment.id}
                  payment={payment}
                  eetSale={eetSales.find(
                    (sale) => sale.paymentId === payment.id
                  )}
                  refundSummary={refundsByPayment.get(payment.id)}
                />
              ))}
            </YStack>
          )}
        </CardContent>
      </Card>

      <Technical>
        <OptionalRow mono label={t("billDetail.id")} value={bill.id} />
        <OptionalRow
          mono
          label={t("paymentDetail.deviceId")}
          value={bill.deviceId}
        />
        {bill.updatedAt === null ? null : (
          <DetailRow
            label={t("paymentDetail.updatedAt")}
            value={formatDateTime(new Date(bill.updatedAt), locale)}
          />
        )}
      </Technical>
    </YStack>
  )
}

function BillPaymentRowView({
  payment,
  eetSale,
  refundSummary,
}: {
  readonly payment: BillPaymentRow
  readonly eetSale: BillEetSale | undefined
  readonly refundSummary: PaymentRefundSummary | undefined
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const hasActiveClaim = payment.claimedTransactions.length > 0
  const now = useNow([payment.expiresAt])
  const status = derivePaymentStatus({
    canceledAt: payment.canceledAt,
    confirmedPaidAt: payment.confirmedPaidAt,
    expiresAt: payment.expiresAt,
    hasActiveClaim,
    now,
  })
  const hasCancellationCollision = derivePaymentHasCancellationCollision({
    canceledAt: payment.canceledAt,
    confirmedPaidAt: payment.confirmedPaidAt,
    hasActiveClaim,
  })
  const amount = formatMoney(
    { value: payment.amount, currency: payment.currency },
    locale
  )

  return (
    <Pressable
      role="button"
      aria-label={`${amount}, ${t(paymentStatusLabelKey[status])}`}
      onPress={() =>
        router.push({
          pathname: "/activity/[paymentId]",
          params: { paymentId: payment.id },
        })
      }
    >
      <XStack gap={12} py={8} items="center">
        <PaymentStatusIcon
          status={status}
          hasCancellationCollision={hasCancellationCollision}
        />
        <YStack flex={1} gap={2}>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
          >
            {amount}
          </Text>
          <XStack items="center" gap={8}>
            <Text
              fontSize={fontSize.xs}
              lineHeight={fontSize.xs}
              color="muted-foreground"
            >
              {formatDateTime(new Date(payment.createdAt), locale)}
            </Text>
            <PaymentMethodIcons
              kinds={payment.claimedTransactions.map(({ kind }) => kind)}
            />
          </XStack>
        </YStack>
        <YStack items="flex-end" gap={4}>
          <PaymentStatusBadge
            status={status}
            label={t(paymentStatusLabelKey[status])}
          />
          <RefundBadge summary={refundSummary} />
          {payment.selfPayId === null ? null : (
            <Badge variant="outline" label={t("billDetail.selfPay")} />
          )}
          {eetSale === undefined ? null : <EetSaleStatusLabel sale={eetSale} />}
        </YStack>
      </XStack>
    </Pressable>
  )
}
