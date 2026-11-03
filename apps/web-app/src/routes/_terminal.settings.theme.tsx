import { createFileRoute } from "@tanstack/react-router"

import { ThemeSettingsPage } from "@/features/settings/theme/theme-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/theme")({
  component: ThemeSettingsPage,
  staticData: {
    access: "free",
    menu: { tab: "settings" },
  },
})
