import { createFileRoute } from "@tanstack/react-router"

import { LightningAddressSettingsPage } from "@/features/settings/payment-accounts/lightning-address-settings-page.tsx"

export const Route = createFileRoute(
  "/_terminal/settings/payment-accounts/lightning-address"
)({
  component: LightningAddressSettingsPage,
  staticData: {
    access: "admin",
    menu: { tab: "settings" },
  },
})
