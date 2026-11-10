import { refundBadgeLabels } from "@payky/app-shared/activity-history"
import type { PaymentRefundSummary } from "@payky/core/modules/refund/refund-utils"
import { Badge } from "@/components/ui/badge.tsx"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

export function RefundBadge({
  summary,
  className,
}: {
  readonly summary: PaymentRefundSummary | undefined
  readonly className?: string
}) {
  const { t } = useTranslation()
  const locale = useLocale()

  return refundBadgeLabels(summary, t, (money) =>
    formatMoney(money, locale)
  ).map((label) => (
    <Badge
      key={label}
      variant="secondary"
      className={cn("bg-warning/10 text-warning", className)}
      data-testid="refund-badge"
    >
      {label}
    </Badge>
  ))
}
