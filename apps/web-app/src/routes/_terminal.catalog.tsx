import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_terminal/catalog")({
  staticData: { access: "catalog", menu: { tab: "catalog" } },
  component: Outlet,
})
