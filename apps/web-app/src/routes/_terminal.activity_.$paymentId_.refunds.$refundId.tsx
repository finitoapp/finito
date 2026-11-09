import { createFileRoute } from "@tanstack/react-router"

import { RefundDetailPage } from "@/features/activity/refund-detail-page.tsx"

export const Route = createFileRoute(
  "/_terminal/activity_/$paymentId_/refunds/$refundId"
)({
  component: RefundDetailRoute,
  staticData: {
    access: "activity",
    menu: { tab: "activity" },
  },
})

function RefundDetailRoute() {
  const { paymentId, refundId } = Route.useParams()

  return <RefundDetailPage paymentId={paymentId} refundId={refundId} />
}
