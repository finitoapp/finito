import { createFileRoute } from "@tanstack/react-router"

import { FiatBankAccountSettingsPage } from "@/features/settings/payment-accounts/fiat-bank-account-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/iban/"
)({
  component: FiatBankAccountSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
