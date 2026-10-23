import { createFileRoute } from "@tanstack/react-router"

import { OrdersToServePage } from "@/features/orders/orders-to-serve-page.tsx"

export const Route = createFileRoute("/_terminal/orders")({
  component: OrdersToServePage,
  staticData: {
    access: "free",
  },
})
