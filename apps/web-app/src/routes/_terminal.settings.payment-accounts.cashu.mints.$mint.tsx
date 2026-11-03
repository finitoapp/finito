import { createFileRoute } from "@tanstack/react-router"

import { CashuMintDetailPage } from "@/features/settings/cashu/cashu-mint-detail-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/cashu/mints/$mint"
)({
  component: CashuMintDetailRoute,
  staticData: { access: "admin", menu: { tab: "settings" } },
})

function CashuMintDetailRoute() {
  const { mint } = Route.useParams()
  return <CashuMintDetailPage mint={mint} />
}
