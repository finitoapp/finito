import { createFileRoute } from "@tanstack/react-router"

import { BillHistoryPage } from "@/features/activity/activity-pages.tsx"

export const Route = createFileRoute("/_terminal/activity_/bills")({
  component: BillHistoryPage,
  staticData: {
    access: "activity",
    menu: { tab: "activity", root: true },
  },
})
