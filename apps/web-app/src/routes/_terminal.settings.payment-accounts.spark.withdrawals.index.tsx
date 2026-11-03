import { createFileRoute } from "@tanstack/react-router"

import { WithdrawHistoryPage } from "@/features/withdraw/withdraw-history-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/spark/withdrawals/"
)({
  component: SparkWithdrawHistoryRoute,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})

function SparkWithdrawHistoryRoute() {
  return <WithdrawHistoryPage method="spark" />
}
