import { createFileRoute } from "@tanstack/react-router"

import { ItemsPage } from "@/features/catalog/items/items-page.tsx"

export const Route = createFileRoute("/_terminal/catalog/items/")({
  component: ItemsPage,
  staticData: {
    access: "catalog",
    menu: { tab: "catalog", root: true },
  },
})
