import { createFileRoute } from "@tanstack/react-router"

import { MonetaPluginSettingsPage } from "@/features/settings/moneta-plugin/moneta-plugin-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/iban/moneta-plugin"
)({
  component: MonetaPluginSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
