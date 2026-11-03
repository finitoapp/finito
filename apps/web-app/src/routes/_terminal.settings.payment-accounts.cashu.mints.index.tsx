import { createFileRoute } from "@tanstack/react-router"

import { CashuMintsPage } from "@/features/settings/cashu/cashu-mints-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/cashu/mints/"
)({
  component: CashuMintsPage,
  staticData: { access: "admin", menu: { tab: "settings" } },
})
