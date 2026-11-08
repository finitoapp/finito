import { atom } from "jotai"

export interface Toast {
  readonly id: number
  readonly variant: "default" | "success" | "error"
  /** Already translated. */
  readonly message: string
  /** A button that runs `onPress` and dismisses the toast, as sonner's. */
  readonly action?: { readonly label: string; readonly onPress: () => void }
}

export const toastsAtom = atom<ReadonlyArray<Toast>>([])

let nextToastId = 0

/** Write-only: appends a toast and returns its id. */
export const showToastAtom = atom(
  null,
  (_get, set, toast: Omit<Toast, "id">): number => {
    const id = ++nextToastId
    set(toastsAtom, (toasts) => [...toasts, { ...toast, id }])
    return id
  }
)

export const dismissToastAtom = atom(null, (_get, set, id: number) => {
  set(toastsAtom, (toasts) => toasts.filter((toast) => toast.id !== id))
})
