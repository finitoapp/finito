import { createFileRoute } from "@tanstack/react-router"

import { PaymentAccountsSettingsPage } from "@/features/settings/payment-accounts/payment-accounts-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/payment-accounts/")({
  component: PaymentAccountsSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
