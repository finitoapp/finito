import { createFileRoute } from "@tanstack/react-router"

import { ProfileSettingsPage } from "@/features/settings/profile/profile-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/profile")({
  component: ProfileSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
