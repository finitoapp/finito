import { createFileRoute } from "@tanstack/react-router"

import { CashuMintNewPage } from "@/features/settings/cashu/cashu-mint-new-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/cashu/mints/new"
)({
  component: CashuMintNewPage,
  staticData: { access: "admin", menu: { tab: "settings" } },
})
