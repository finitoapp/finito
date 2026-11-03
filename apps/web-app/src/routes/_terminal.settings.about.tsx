import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_terminal/settings/about")({
  component: Outlet,
  staticData: {
    access: "free",
    menu: { tab: "settings" },
  },
})
