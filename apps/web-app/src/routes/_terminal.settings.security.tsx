import { createFileRoute } from "@tanstack/react-router"

import { SecuritySettingsPage } from "@/features/settings/security/security-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/security")({
  component: SecuritySettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
