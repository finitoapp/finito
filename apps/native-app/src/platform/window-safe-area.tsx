import type { ReactNode } from "react"

/**
 * The page's safe area on the web (`window-safe-area.web.tsx`). Native
 * keeps Expo Router's `SafeAreaProvider`, whose insets come from the OS.
 */
export function WindowSafeArea({ children }: { readonly children: ReactNode }) {
  return children
}
