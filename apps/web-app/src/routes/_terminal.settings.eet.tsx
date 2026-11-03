import { createFileRoute } from "@tanstack/react-router"

import { EetSettingsPage } from "@/features/settings/eet/eet-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/eet")({
  component: EetSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
