import { createFileRoute } from "@tanstack/react-router"

import { FioPluginSettingsPage } from "@/features/settings/fio-plugin/fio-plugin-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/iban/fio-plugin"
)({
  component: FioPluginSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
