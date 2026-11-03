import { createFileRoute } from "@tanstack/react-router"

import { DemoDataPage } from "@/features/settings/demo-data/demo-data-page.tsx"

export const Route = createFileRoute("/_terminal/settings/demo-data")({
  component: DemoDataPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
