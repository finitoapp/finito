import { createFileRoute } from "@tanstack/react-router"

import { CashuAccountSettingsPage } from "@/features/settings/cashu/cashu-account-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/cashu/"
)({
  component: CashuAccountSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
