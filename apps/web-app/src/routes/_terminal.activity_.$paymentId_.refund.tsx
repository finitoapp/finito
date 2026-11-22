import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { RefundPage } from "@/features/activity/refund-page.tsx"

// Falls back instead of throwing: a `validateSearch` throw on a stale link
// would escape to the global error boundary. `choice` only preselects what
// the screen offers, as the payment's collision does.
const RefundSearchSchema = z.object({
  choice: z
    .enum(["overpayment", "whole", "part", "tip"])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/_terminal/activity_/$paymentId_/refund")(
  {
    component: RefundRoute,
    validateSearch: (search) => RefundSearchSchema.parse(search),
    staticData: {
      access: "refund",
      menu: { tab: "activity" },
    },
  }
)

function RefundRoute() {
  const { paymentId } = Route.useParams()
  const { choice } = Route.useSearch()

  return <RefundPage paymentId={paymentId} initialChoice={choice} />
}
