import { createFileRoute } from "@tanstack/react-router"

import { BillDetailPage } from "@/features/activity/activity-pages.tsx"

export const Route = createFileRoute("/_terminal/activity_/bills_/$billId")({
  component: BillDetailRoute,
  staticData: {
    access: "activity",
    menu: { tab: "activity" },
  },
})

function BillDetailRoute() {
  const { billId } = Route.useParams()

  return <BillDetailPage billId={billId} />
}
