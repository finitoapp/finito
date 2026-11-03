import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_terminal/settings")({
  staticData: { access: "free", menu: { tab: "settings" } },
  component: Outlet,
})
