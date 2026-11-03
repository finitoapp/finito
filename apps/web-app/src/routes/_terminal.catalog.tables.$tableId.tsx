import { createFileRoute } from "@tanstack/react-router"

import { EditTablePage } from "@/features/catalog/tables/table-form-page.tsx"

export const Route = createFileRoute("/_terminal/catalog/tables/$tableId")({
  component: EditTableRoute,
  staticData: {
    access: "catalog",
    menu: { tab: "catalog" },
  },
})

function EditTableRoute() {
  const { tableId } = Route.useParams()

  return <EditTablePage tableId={tableId} />
}
