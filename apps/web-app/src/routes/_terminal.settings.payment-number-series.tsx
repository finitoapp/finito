import { createFileRoute } from "@tanstack/react-router"

import { PaymentNumberSeriesSettingsPage } from "@/features/settings/payment-number-series/payment-number-series-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-number-series"
)({
  component: PaymentNumberSeriesSettingsPage,
  staticData: {
    access: "settings",
    menu: { tab: "settings" },
  },
})
