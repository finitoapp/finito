import { createFileRoute } from "@tanstack/react-router"

import { NewTablePage } from "@/features/catalog/tables/table-form-page.tsx"

export const Route = createFileRoute("/_terminal/catalog/tables/new")({
  component: NewTablePage,
  staticData: {
    access: "catalog",
    menu: { tab: "catalog" },
  },
})
