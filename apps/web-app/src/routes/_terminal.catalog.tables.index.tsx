import { createFileRoute } from "@tanstack/react-router"

import { TablesPage } from "@/features/catalog/tables/tables-page.tsx"

export const Route = createFileRoute("/_terminal/catalog/tables/")({
  component: TablesPage,
  staticData: {
    access: "catalog",
    menu: { tab: "catalog", root: true },
  },
})
