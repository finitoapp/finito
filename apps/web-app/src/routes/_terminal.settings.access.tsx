import { createFileRoute } from "@tanstack/react-router"

import { AccessSettingsPage } from "@/features/settings/access/access-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/access")({
  component: AccessSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
