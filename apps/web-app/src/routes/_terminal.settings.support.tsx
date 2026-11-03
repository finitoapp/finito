import { createFileRoute } from "@tanstack/react-router"

import { SupportChatPage } from "@/features/settings/support/support-chat-page.tsx"

export const Route = createFileRoute("/_terminal/settings/support")({
  component: SupportChatPage,
  staticData: {
    access: "settings",
    menu: { tab: "settings" },
  },
})
