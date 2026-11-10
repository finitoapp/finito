import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { BillDetailPage } from "@/features/activity/activity-pages.tsx"

const BillDetailSearchSchema = z.object({
  afterEdit: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute("/_terminal/activity_/bills_/$billId")({
  validateSearch: (search) => BillDetailSearchSchema.parse(search),
  component: BillDetailRoute,
  staticData: {
    access: "activity",
    menu: { tab: "activity" },
  },
})

function BillDetailRoute() {
  const { billId } = Route.useParams()
  const { afterEdit } = Route.useSearch()

  return <BillDetailPage billId={billId} afterEdit={afterEdit} />
}
