import { createFileRoute } from "@tanstack/react-router"

import { SparkAccountSettingsPage } from "@/features/settings/payment-accounts/spark-account-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/spark/"
)({
  component: SparkAccountSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
