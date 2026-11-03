import { createFileRoute } from "@tanstack/react-router"

import { EditCatalogCategoryPage } from "@/features/catalog/categories/category-form-page.tsx"

export const Route = createFileRoute(
  "/_terminal/catalog/categories/$catalogCategoryId"
)({
  component: EditCategoryRoute,
  staticData: {
    access: "catalog",
    menu: { tab: "catalog" },
  },
})

function EditCategoryRoute() {
  const { catalogCategoryId } = Route.useParams()

  return <EditCatalogCategoryPage catalogCategoryId={catalogCategoryId} />
}
