import { createFileRoute } from "@tanstack/react-router"

import { NotificationsPage } from "@/features/notifications/notifications-page.tsx"

export const Route = createFileRoute("/_terminal/notifications")({
  component: NotificationsPage,
  staticData: {
    access: "free",
  },
})
