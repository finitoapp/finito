import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { RouteMessage } from "@/components/route-message.tsx"
import { PaymentCustomTipPage } from "@/features/payment-tip/payment-custom-tip-page.tsx"
import { PaymentTipSearchSchema } from "@/features/payment-tip/payment-tip-search.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export const Route = createFileRoute("/_terminal/payment/custom-tip")({
  component: PaymentCustomTipRoute,
  validateSearch: (search) => PaymentTipSearchSchema.parse(search),
  staticData: {
    access: "sell",
    terminalLayout: {
      viewportClassName:
        "h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-var(--terminal-banner-height,0px))] px-6 py-6",
    },
  },
})

function PaymentCustomTipRoute() {
  const { t } = useTranslation()
  const { amount, currency, billId } = Route.useSearch()

  if (amount === undefined || currency === undefined) {
    return <RouteMessage>{t("paymentTip.invalidLink")}</RouteMessage>
  }

  return (
    <Suspense fallback={null}>
      <PaymentCustomTipPage
        amount={NonNegativeInteger(amount)}
        currency={currency}
        billId={billId ?? null}
      />
    </Suspense>
  )
}
