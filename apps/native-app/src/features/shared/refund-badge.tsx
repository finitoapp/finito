import { refundBadgeLabels } from "@payky/app-shared/activity-history"
import type { PaymentRefundSummary } from "@payky/core/modules/refund/refund-utils"
import { Badge } from "../../components/ui/badge.tsx"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"

/** Web's `RefundBadge`: warning-tinted secondary badges with the refunded parts. */
export function RefundBadge({
  summary,
}: {
  readonly summary: PaymentRefundSummary | undefined
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  return refundBadgeLabels(summary, t, (money) =>
    formatMoney(money, locale)
  ).map((label) => (
    <Badge
      key={label}
      variant="secondary"
      bg="warning-10"
      labelColor="warning"
      label={label}
      testID="refund-badge"
    />
  ))
}
