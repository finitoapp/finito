import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/cashu/withdrawals"
)({
  staticData: { access: "admin", menu: { tab: "settings" } },
  component: Outlet,
})
