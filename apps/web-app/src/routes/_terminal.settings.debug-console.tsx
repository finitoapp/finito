import { createFileRoute } from "@tanstack/react-router"

import { DebugConsoleSettingsPage } from "@/features/settings/debug-console/debug-console-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/debug-console")({
  component: DebugConsoleSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
