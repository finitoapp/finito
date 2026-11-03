import { createFileRoute } from "@tanstack/react-router"

import { NewCatalogCategoryPage } from "@/features/catalog/categories/category-form-page.tsx"

export const Route = createFileRoute("/_terminal/catalog/categories/new")({
  component: NewCatalogCategoryPage,
  staticData: {
    access: "catalog",
    menu: { tab: "catalog" },
  },
})
