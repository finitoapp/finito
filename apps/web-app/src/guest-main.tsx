import { brandName, brandOfSelfPayHost } from "@payky/app-shared/brand"
import { QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { queryClient } from "@/core/query-client.ts"
import { GuestLanguageProvider } from "@/features/table-self-pay-guest/guest-language.tsx"
import { TableSelfPayGuestPage } from "@/features/table-self-pay-guest/table-self-pay-guest-page.tsx"
import "@/index.css"

if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.documentElement.classList.add("dark")
}
history.scrollRestoration = "manual"
document.title = brandName(brandOfSelfPayHost(window.location.host))

const rootElement = document.getElementById("root")

if (rootElement === null) {
  throw new Error("Root element was not found.")
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GuestLanguageProvider>
        <TableSelfPayGuestPage address={window.location.href} />
      </GuestLanguageProvider>
    </QueryClientProvider>
  </StrictMode>
)
