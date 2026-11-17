import { createFileRoute } from "@tanstack/react-router"

import { BackendsSettingsPage } from "@/features/settings/backends/backends-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/backends")({
  component: BackendsSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
