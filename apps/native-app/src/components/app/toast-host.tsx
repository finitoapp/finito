import { useAtomValue, useSetAtom } from "jotai"
import { type ReactNode, useEffect } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { YStack } from "tamagui"
import {
  dismissToastAtom,
  type Toast as ToastData,
  toastOffset,
  toastsAtom,
} from "../../atoms/toast.ts"
import { menuBarHeight, useMenuBarTab } from "../menu-nav.tsx"
import { Toast } from "../ui/toast.tsx"

const DISMISS_AFTER_MS = 4000

function ToastItem({ toast }: { readonly toast: ToastData }) {
  const dismiss = useSetAtom(dismissToastAtom)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), DISMISS_AFTER_MS)
    return () => clearTimeout(timer)
  }, [dismiss, toast.id])

  return (
    <Toast
      variant={toast.variant}
      message={toast.message}
      onPress={() => dismiss(toast.id)}
      action={
        toast.action === undefined
          ? undefined
          : {
              label: toast.action.label,
              onPress: () => {
                dismiss(toast.id)
                toast.action?.onPress()
              },
            }
      }
    />
  )
}

/** Mount once inside the Jotai Provider and TamaguiProvider. */
export function ToastHost({ children }: { readonly children?: ReactNode }) {
  const toasts = useAtomValue(toastsAtom)
  const insets = useSafeAreaInsets()
  const menuBarRoom = useMenuBarTab() === undefined ? 0 : menuBarHeight
  return (
    <YStack
      position="absolute"
      b={toastOffset + insets.bottom + menuBarRoom}
      l={16}
      r={16}
      gap="2"
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
      {children}
    </YStack>
  )
}
