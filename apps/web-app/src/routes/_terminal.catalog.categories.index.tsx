import { createFileRoute } from "@tanstack/react-router"

import { CategoriesPage } from "@/features/catalog/categories/categories-page.tsx"

export const Route = createFileRoute("/_terminal/catalog/categories/")({
  component: CategoriesPage,
  staticData: {
    access: "catalog",
    menu: { tab: "catalog", root: true },
  },
})
