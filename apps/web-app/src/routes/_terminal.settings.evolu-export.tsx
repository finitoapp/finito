import { createFileRoute } from "@tanstack/react-router"

import { EvoluExportPage } from "@/features/settings/evolu-export/evolu-export-page.tsx"

export const Route = createFileRoute("/_terminal/settings/evolu-export")({
  component: EvoluExportPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
