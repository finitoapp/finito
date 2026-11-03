import { createFileRoute } from "@tanstack/react-router"

import { TermsPage } from "@/features/settings/about/terms-page.tsx"

export const Route = createFileRoute("/_terminal/settings/about/terms")({
  component: TermsPage,
  staticData: {
    access: "free",
    menu: { tab: "settings" },
  },
})
