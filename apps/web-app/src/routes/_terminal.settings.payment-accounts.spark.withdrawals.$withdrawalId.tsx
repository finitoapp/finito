import { createFileRoute } from "@tanstack/react-router"

import { WithdrawDetailPage } from "@/features/withdraw/withdraw-detail-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/spark/withdrawals/$withdrawalId"
)({
  component: WithdrawDetailRoute,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})

function WithdrawDetailRoute() {
  const { withdrawalId } = Route.useParams()

  return <WithdrawDetailPage withdrawalId={withdrawalId} />
}
