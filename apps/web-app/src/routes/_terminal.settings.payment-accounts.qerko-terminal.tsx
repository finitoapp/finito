import { createFileRoute } from "@tanstack/react-router"

import { QerkoTerminalSettingsPage } from "@/features/settings/payment-accounts/qerko-terminal-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/qerko-terminal"
)({
  component: QerkoTerminalSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
