import { createFileRoute } from "@tanstack/react-router"

import { AccountTransferSourcePage } from "@/features/settings/account-transfer-source-page.tsx"

export const Route = createFileRoute("/_terminal/settings/access_/add-device")({
  component: AccountTransferSourcePage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
