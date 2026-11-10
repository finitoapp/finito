import type {
  BillCoverageMismatchReason,
  BillCoverageWarningCoverage,
} from "@payky/app-shared/activity-detail"
import {
  type Currency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { AlertTriangleIcon } from "lucide-react"
import type { ReactNode } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"

/**
 * "This bill's claimed total doesn't match its line total" — the expected
 * vs. paid breakdown shown on both bill-shaped screens (`bill-detail.tsx`
 * and `payment-detail.tsx`'s bill card).
 *
 * Deciding *whether* to warn stays with the caller: `payment-detail.tsx`
 * additionally requires `claimedSum > 0` before calling an underpaid bill
 * underpaid, because an open bill with nothing claimed against it yet is
 * also "underpaid" by `deriveBillCoverage`'s definition. `children` renders
 * after the two amount rows, for callers with more to say about the cause.
 */
export function BillCoverageWarning({
  coverage,
  expectedAmount,
  claimedSum,
  currency,
  reason = null,
  children,
}: {
  readonly coverage: BillCoverageWarningCoverage
  readonly expectedAmount: NonNegativeInteger
  readonly claimedSum: NonNegativeInteger
  readonly currency: Currency
  readonly reason?: BillCoverageMismatchReason | null
  readonly children?: ReactNode
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isUnderpaid = coverage.type === "underpaid"
  const delta = NonNegativeInteger(Math.abs(expectedAmount - claimedSum))

  return (
    <Alert variant="warning">
      <AlertTriangleIcon />
      <AlertTitle>
        {coverage.type === "underpaid"
          ? t("paymentDetail.bill.coverage.underpaid.title")
          : t("overpayment.title", {
              amount: formatMoney(
                { value: coverage.unresolved, currency },
                locale
              ),
            })}
      </AlertTitle>
      <AlertDescription>
        {isUnderpaid ? (
          <p className="text-sm font-semibold text-foreground">
            {t("paymentDetail.bill.coverage.delta.underpaid", {
              amount: formatMoney({ value: delta, currency }, locale),
            })}
          </p>
        ) : null}
        <p>
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
                {
                  reason: t(`paymentDetail.bill.coverage.reason.${reason}`),
                }
              )}
        </p>
        <BillCoverageAmountRow
          label={t("paymentDetail.bill.coverage.expectedAmount")}
          value={formatMoney({ value: expectedAmount, currency }, locale)}
        />
        <BillCoverageAmountRow
          label={t("paymentDetail.bill.coverage.paidAmount")}
          value={formatMoney({ value: claimedSum, currency }, locale)}
        />
        {children}
      </AlertDescription>
    </Alert>
  )
}

function BillCoverageAmountRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
