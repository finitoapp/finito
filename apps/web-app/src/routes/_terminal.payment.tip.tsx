import { BillId } from "@payky/core/modules/bill/bill-types"
import {
  FiatCurrencySchema,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { z } from "zod"
import { RouteMessage } from "@/components/route-message.tsx"
import { PaymentTipPage } from "@/features/payment-tip/payment-tip-page.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

// Every field falls back instead of throwing: a `validateSearch` throw on a
// stale or hand-typed link escapes to the global error boundary (see
// `_terminal.bill.tsx`). No amount or currency means there is nothing to tip
// on, which the component shows; a broken `billId` only loses the bill link.
const PaymentTipSearchSchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .optional()
    .catch(undefined),
  currency: FiatCurrencySchema.optional().catch(undefined),
  billId: BillId.optional().catch(undefined),
})

export const Route = createFileRoute("/_terminal/payment/tip")({
  component: PaymentTipRoute,
  validateSearch: (search) => PaymentTipSearchSchema.parse(search),
  staticData: {
    access: "sell",
    terminalLayout: {
      viewportClassName:
        "h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-var(--terminal-banner-height,0px)-var(--waiting-orders-notice-height,0px))] px-6 py-6",
    },
  },
})

function PaymentTipRoute() {
  const { t } = useTranslation()
  const { amount, currency, billId } = Route.useSearch()

  if (amount === undefined || currency === undefined) {
    return <RouteMessage>{t("paymentTip.invalidLink")}</RouteMessage>
  }

  return (
    <Suspense fallback={null}>
      <PaymentTipPage
        amount={NonNegativeInteger(amount)}
        currency={currency}
        billId={billId ?? null}
      />
    </Suspense>
  )
}
