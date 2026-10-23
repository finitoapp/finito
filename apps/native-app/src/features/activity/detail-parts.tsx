import type { BillCoverageMismatchReason } from "@payky/app-shared/activity-detail"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import { getBillLineSummaryUnitAmount } from "@payky/core/modules/bill-line/bill-line-utils"
import {
  type Currency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { projectSelfPayViewLine } from "@payky/core/modules/table-self-pay/table-self-pay-projection-utils"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import type { ReactNode } from "react"
import { Text, XStack, YStack } from "tamagui"
import { DetailRow } from "../../components/detail-row.tsx"
import { FadeHeader } from "../../components/fade-header.tsx"
import { Screen } from "../../components/screen.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible.tsx"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/** The building blocks of the payment and bill detail screens. */

/** Header and a scrolling column; `title` is already translated. */
export function DetailScreen({
  title,
  children,
}: {
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <Screen>
      <FadeHeader title={title} />
      {children}
    </Screen>
  )
}

/** A row that is not shown at all while its value is absent. */
export function OptionalRow({
  label,
  value,
  mono,
}: {
  readonly label: string
  readonly value: string | null
  readonly mono?: boolean
}) {
  if (value === null) return null
  return <DetailRow label={label} value={value} mono={mono === true} />
}

/**
 * Identifiers and bookkeeping staff rarely need, collapsed by default, as
 * web's `PaymentDetailTechnical`: an xs muted trigger with a chevron.
 */
export function Technical({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <Collapsible>
      <CollapsibleTrigger self="flex-start">
        <TechnicalTriggerLabel label={t("paymentDetail.technical")} />
      </CollapsibleTrigger>
      <CollapsibleContent gap={8} pt={8}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function TechnicalTriggerLabel({ label }: { readonly label: string }) {
  return (
    <XStack items="center" gap={4}>
      <Text
        fontSize={fontSize.xs}
        lineHeight={fontSize.xs}
        fontWeight={fontWeight.medium}
        color="muted-foreground"
      >
        {label}
      </Text>
      <CollapsibleChevron size={14} color="muted-foreground" />
    </XStack>
  )
}

export function BillLines({
  summaries,
  emptyMessage,
  selfPayAllocated,
}: {
  readonly summaries: ReadonlyArray<BillLineSummary>
  readonly emptyMessage: string
  readonly selfPayAllocated?: ReadonlyMap<string, number>
}) {
  const locale = useLocale()

  if (summaries.length === 0)
    return (
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="muted-foreground"
      >
        {emptyMessage}
      </Text>
    )

  return (
    <YStack>
      {summaries.map((summary) => (
        <XStack
          key={summary.id}
          items="center"
          justify="space-between"
          gap={8}
          py={8}
        >
          <YStack flex={1} minW={0}>
            <Text
              numberOfLines={1}
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
            >
              {summary.name}
            </Text>
            <Text
              fontSize={fontSize.xs}
              lineHeight={fontSize.xs}
              color="muted-foreground"
            >
              {`${summary.quantity} × ${formatMoney(
                {
                  value: getBillLineSummaryUnitAmount(summary),
                  currency: summary.currency,
                },
                locale
              )}`}
            </Text>
            {selfPayAllocated === undefined ? null : (
              <SelfPayLinePaid
                paid={
                  projectSelfPayViewLine(summary, selfPayAllocated)
                    .allocatedAmount
                }
                total={summary.totalAmount}
                currency={summary.currency}
              />
            )}
          </YStack>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
          >
            {formatMoney(
              { value: summary.totalAmount, currency: summary.currency },
              locale
            )}
          </Text>
        </XStack>
      ))}
    </YStack>
  )
}

/** As web's `SelfPayLinePaid`: what guests paid of a line. */
function SelfPayLinePaid({
  paid,
  total,
  currency,
}: {
  readonly paid: number
  readonly total: NonNegativeInteger
  readonly currency: Currency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  if (paid === 0) return null

  return (
    <Text fontSize={fontSize.xs} lineHeight={fontSize.xs} color="primary">
      {t("billDetail.selfPay.linePaid", {
        paid: formatMoney(
          { value: NonNegativeInteger(paid), currency },
          locale
        ),
        total: formatMoney({ value: total, currency }, locale),
      })}
    </Text>
  )
}

/** "This bill's claimed total doesn't match its line total": expected vs. paid. */
export function BillCoverageWarning({
  coverage,
  expectedAmount,
  claimedSum,
  currency,
  reason = null,
  children,
}: {
  readonly coverage: "underpaid" | "overpaid"
  readonly expectedAmount: NonNegativeInteger
  readonly claimedSum: NonNegativeInteger
  readonly currency: Currency
  readonly reason?: BillCoverageMismatchReason | null
  readonly children?: ReactNode
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isUnderpaid = coverage === "underpaid"
  const delta = NonNegativeInteger(Math.abs(expectedAmount - claimedSum))

  return (
    <Alert variant="warning" icon={TriangleAlert}>
      <AlertTitle>
        {t(
          isUnderpaid
            ? "paymentDetail.bill.coverage.underpaid.title"
            : "paymentDetail.bill.coverage.overpaid.title"
        )}
      </AlertTitle>
      <AlertDescription>
        <Text fontSize="sm" lineHeight="sm" fontWeight="600">
          {t(
            isUnderpaid
              ? "paymentDetail.bill.coverage.delta.underpaid"
              : "paymentDetail.bill.coverage.delta.overpaid",
            { amount: formatMoney({ value: delta, currency }, locale) }
          )}
        </Text>
        {reason === null
          ? t(
              isUnderpaid
                ? "paymentDetail.bill.coverage.underpaid.fact"
                : "paymentDetail.bill.coverage.overpaid.fact"
            )
          : t(
              isUnderpaid
                ? "paymentDetail.bill.coverage.underpaid.factWithReason"
                : "paymentDetail.bill.coverage.overpaid.factWithReason",
              { reason: t(`paymentDetail.bill.coverage.reason.${reason}`) }
            )}
        <DetailRow
          label={t("paymentDetail.bill.coverage.expectedAmount")}
          value={formatMoney({ value: expectedAmount, currency }, locale)}
        />
        <DetailRow
          label={t("paymentDetail.bill.coverage.paidAmount")}
          value={formatMoney({ value: claimedSum, currency }, locale)}
        />
        {children}
      </AlertDescription>
    </Alert>
  )
}
