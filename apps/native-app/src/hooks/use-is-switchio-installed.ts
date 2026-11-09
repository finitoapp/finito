import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { AppState } from "react-native"
import { isSwitchioInstalled } from "../platform/switchio.ts"

const switchioInstalledQueryKey = ["switchioInstalled"] as const

/**
 * Whether this phone can launch SwitchioPay, asked once and again whenever
 * the app comes back to the foreground: SwitchioPay is installed or removed
 * outside the app, and nothing re-renders a screen when it is. Asking the
 * package manager on every render instead would cost a bridge call each
 * time and still miss the install until something else re-rendered.
 */
export function useIsSwitchioInstalled(): boolean {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: switchioInstalledQueryKey,
    queryFn: () => isSwitchioInstalled(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void queryClient.invalidateQueries({
          queryKey: switchioInstalledQueryKey,
        })
      }
    })
    return () => subscription.remove()
  }, [queryClient])

  return data === true
}
