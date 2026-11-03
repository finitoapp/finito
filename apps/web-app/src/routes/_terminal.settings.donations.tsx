import { createFileRoute } from "@tanstack/react-router"

import { DonationsSettingsPage } from "@/features/settings/donations/donations-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/donations")({
  component: DonationsSettingsPage,
  staticData: {
    access: "free",
    menu: { tab: "settings" },
  },
})
