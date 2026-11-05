import { createFileRoute } from "@tanstack/react-router"

import { QerkoPaymentSettingsPage } from "@/features/settings/payment-accounts/qerko-payment-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/qerko-payment"
)({
  component: QerkoPaymentSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
