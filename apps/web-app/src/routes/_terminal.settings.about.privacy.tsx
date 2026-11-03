import { createFileRoute } from "@tanstack/react-router"

import { PrivacySettingsPage } from "@/features/settings/privacy/privacy-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/about/privacy")({
  component: PrivacySettingsPage,
  staticData: {
    access: "free",
    menu: { tab: "settings" },
  },
})
