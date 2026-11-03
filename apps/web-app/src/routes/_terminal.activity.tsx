import { createFileRoute } from "@tanstack/react-router"

import { PaymentHistoryPage } from "@/features/activity/activity-pages.tsx"

export const Route = createFileRoute("/_terminal/activity")({
  component: PaymentHistoryPage,
  staticData: {
    access: "activity",
    menu: { tab: "activity", root: true },
  },
})
