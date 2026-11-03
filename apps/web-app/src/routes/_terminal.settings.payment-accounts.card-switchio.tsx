import { createFileRoute } from "@tanstack/react-router"

import { CardSwitchioSettingsPage } from "@/features/settings/payment-accounts/card-switchio-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/card-switchio"
)({
  component: CardSwitchioSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
