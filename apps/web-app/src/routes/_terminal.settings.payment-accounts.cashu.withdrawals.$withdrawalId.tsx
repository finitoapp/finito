import { createFileRoute } from "@tanstack/react-router"

import { WithdrawDetailPage } from "@/features/withdraw/withdraw-detail-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/cashu/withdrawals/$withdrawalId"
)({
  component: CashuWithdrawDetailRoute,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})

function CashuWithdrawDetailRoute() {
  const { withdrawalId } = Route.useParams()

  return <WithdrawDetailPage withdrawalId={withdrawalId} />
}
