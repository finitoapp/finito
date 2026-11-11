import { createFileRoute } from "@tanstack/react-router"

import { ActivityLayout } from "@/features/activity/activity-layout.tsx"

/**
 * The header and tabs Activity's three root screens share (navigation/0001),
 * drawn once so the tabs keep their place and their pill slides between
 * them. Free: each screen under it declares what it needs, the statistics
 * `stats` (access/0012).
 */
export const Route = createFileRoute("/_terminal/activity")({
  component: ActivityLayout,
  staticData: {
    access: "free",
    menu: { tab: "activity", root: true },
  },
})
