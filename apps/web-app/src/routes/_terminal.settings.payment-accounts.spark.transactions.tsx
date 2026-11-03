import { createFileRoute } from "@tanstack/react-router"

import { SparkTransactionsPage } from "@/features/settings/payment-accounts/spark-transactions-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/spark/transactions"
)({
  component: SparkTransactionsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
