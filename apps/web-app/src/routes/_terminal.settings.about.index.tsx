import { createFileRoute } from "@tanstack/react-router"

import { AboutPage } from "@/features/settings/about/about-page.tsx"

export const Route = createFileRoute("/_terminal/settings/about/")({
  component: AboutPage,
  staticData: {
    access: "free",
    menu: { tab: "settings" },
  },
})
