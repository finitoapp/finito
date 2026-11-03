import { createFileRoute, Navigate } from "@tanstack/react-router"

/** The catalog opens on its items (navigation/0001). */
export const Route = createFileRoute("/_terminal/catalog/")({
  component: () => <Navigate to="/catalog/items" replace />,
  staticData: { access: "catalog", menu: { tab: "catalog" } },
})
