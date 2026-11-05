import { parseOpenAccountStep } from "@payky/app-shared/open-account"
import { createFileRoute } from "@tanstack/react-router"

import { OpenAccountPage } from "@/features/settings/accounts/open-account-page.tsx"

export const Route = createFileRoute("/_terminal/settings/accounts_/open")({
  component: OpenAccountRoute,
  // A stale or typed step falls back to the chooser instead of throwing.
  validateSearch: (search) => ({ step: parseOpenAccountStep(search.step) }),
  staticData: {
    // Adds an account to this device, owner-only like the accounts screen.
    access: "admin",
    menu: { tab: "settings" },
  },
})

function OpenAccountRoute() {
  return <OpenAccountPage step={Route.useSearch().step} />
}
