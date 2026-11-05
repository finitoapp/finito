import { createFileRoute } from "@tanstack/react-router"

import { AccountSharePage } from "@/features/settings/account-share-page.tsx"

export const Route = createFileRoute("/_terminal/settings/accounts_/share")({
  component: AccountSharePage,
  staticData: {
    // Hands the account to another app (account/0008), owner-only like
    // `access_/add-device`.
    access: "admin",
    menu: { tab: "settings" },
  },
})
