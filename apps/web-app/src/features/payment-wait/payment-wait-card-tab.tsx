import { CreditCardIcon, LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button.tsx"
import type { CardPaymentTabProps } from "@/features/payment-wait/payment-wait-types.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function CardPaymentTab({
  canPayCard,
  cardPaymentErrorKey,
  cardPaymentPending,
  cardAccountId,
  cardUnresolvedTransactionId,
  onPayCard,
}: CardPaymentTabProps) {
  const { t } = useTranslation()
  // The attempt is written unresolved before the terminal opens, so while it
  // runs the marker names the attempt itself, not an earlier one.
  const unresolvedTransactionId = cardPaymentPending
    ? null
    : cardUnresolvedTransactionId

  return (
    <div className="flex w-full flex-col items-center py-4">
      <Button
        type="button"
        size="lg"
        disabled={!canPayCard || cardPaymentPending}
        onClick={onPayCard}
        className="h-14 px-8 text-base"
      >
        {cardPaymentPending ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : (
          <CreditCardIcon />
        )}
        {cardPaymentPending
          ? t("paymentWait.cardPaid.pending")
          : t("paymentWait.cardPaid.action")}
      </Button>
      {unresolvedTransactionId ? (
        <p className="max-w-72 text-balance text-sm font-medium text-destructive">
          {t("paymentWait.cardPaid.unresolved", {
            transactionId: unresolvedTransactionId,
          })}
        </p>
      ) : null}
      {cardPaymentErrorKey && !unresolvedTransactionId ? (
        <p className="text-sm font-medium text-destructive">
          {t(cardPaymentErrorKey)}
        </p>
      ) : null}
      {cardAccountId === null || cardAccountId === undefined ? (
        <p className="max-w-72 text-balance text-sm text-muted-foreground">
          {t("paymentWait.cardPaid.unavailable")}
        </p>
      ) : null}
    </div>
  )
}
