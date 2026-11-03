import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { WithdrawPage } from "@/features/withdraw/withdraw-page.tsx"

// A malformed `destination` only loses the prefill, so it falls back to none.
const WithdrawNewSearchSchema = z.object({
  destination: z.string().optional().catch(undefined),
})

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/spark/withdrawals/new"
)({
  component: WithdrawNewRoute,
  validateSearch: (search) => WithdrawNewSearchSchema.parse(search),
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})

function WithdrawNewRoute() {
  const { destination } = Route.useSearch()
  return <WithdrawPage initialDestination={destination ?? ""} />
}
