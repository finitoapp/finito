import { createFileRoute } from "@tanstack/react-router"

import { LegalEntitySettingsPage } from "@/features/settings/legal-entity/legal-entity-settings-page.tsx"

export const Route = createFileRoute("/_terminal/settings/legal-entity")({
  component: LegalEntitySettingsPage,
  staticData: {
    access: "settings",
    menu: { tab: "settings" },
  },
})
