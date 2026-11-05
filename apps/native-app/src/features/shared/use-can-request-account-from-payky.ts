import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect } from "react"
import { AppState, Platform } from "react-native"
import { canRequestAccountFromPayky } from "../../platform/payky-account-request.ts"

export const canRequestAccountFromPaykyQueryKey = [
  "canRequestAccountFromPayky",
] as const

/**
 * Detection asked again: after the app comes back to the foreground (Payky
 * may have been installed, updated or removed meanwhile) and after a launch
 * that found no Payky.
 */
export const invalidateCanRequestAccountFromPayky = async (
  queryClient: QueryClient
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: canRequestAccountFromPaykyQueryKey,
  })
}

/**
 * Whether to offer the transfer from Payky (account/0008): only when the
 * installed Payky takes the request, never as a disabled button or a prompt
 * to install it. Always `false` off Android, where the module is not asked.
 */
export function useCanRequestAccountFromPayky(): boolean {
  const queryClient = useQueryClient()
  const enabled = Platform.OS === "android"
  const { data } = useQuery({
    queryKey: canRequestAccountFromPaykyQueryKey,
    enabled,
    queryFn: () => canRequestAccountFromPayky(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

  useEffect(() => {
    if (!enabled) return undefined
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void invalidateCanRequestAccountFromPayky(queryClient)
      }
    })
    return () => subscription.remove()
  }, [enabled, queryClient])

  return enabled && data === true
}
