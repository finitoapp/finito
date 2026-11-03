import { createFileRoute } from "@tanstack/react-router"

import { EditCatalogItemPage } from "@/features/catalog/items/item-form-page.tsx"

export const Route = createFileRoute("/_terminal/catalog/items/$catalogItemId")(
  {
    component: EditItemRoute,
    staticData: {
      access: "catalog",
      menu: { tab: "catalog" },
    },
  }
)

function EditItemRoute() {
  const { catalogItemId } = Route.useParams()

  return <EditCatalogItemPage catalogItemId={catalogItemId} />
}
