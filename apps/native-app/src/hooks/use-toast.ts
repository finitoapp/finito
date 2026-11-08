import { useSetAtom } from "jotai"
import { useMemo } from "react"
import { showToastAtom } from "../atoms/toast.ts"

/**
 * `toast.success(message)` / `toast.error(message)` with translated text, and
 * `toast.withAction(message, action)` for sonner's plain toast with an action.
 */
export function useToast() {
  const show = useSetAtom(showToastAtom)
  return useMemo(
    () => ({
      success: (message: string) => show({ variant: "success", message }),
      error: (message: string) => show({ variant: "error", message }),
      withAction: (
        message: string,
        action: { readonly label: string; readonly onPress: () => void }
      ) => show({ variant: "default", message, action }),
    }),
    [show]
  )
}
