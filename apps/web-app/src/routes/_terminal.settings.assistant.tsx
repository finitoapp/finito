import { createFileRoute } from "@tanstack/react-router"

import { AssistantChatPage } from "@/features/settings/assistant/assistant-chat-page.tsx"

export const Route = createFileRoute("/_terminal/settings/assistant")({
  component: AssistantChatPage,
  staticData: {
    access: "activity",
    menu: { tab: "settings" },
  },
})
