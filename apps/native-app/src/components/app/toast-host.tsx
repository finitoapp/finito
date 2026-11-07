import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { YStack } from "tamagui"
import {
  dismissToastAtom,
  type Toast as ToastData,
  toastLifetimeMs,
  toastsAtom,
} from "../../atoms/toast.ts"
import { Toast } from "../ui/toast.tsx"

function ToastItem({ toast }: { readonly toast: ToastData }) {
  const dismiss = useSetAtom(dismissToastAtom)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toastLifetimeMs(toast))
    return () => clearTimeout(timer)
  }, [dismiss, toast])

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
export function ToastHost() {
  const toasts = useAtomValue(toastsAtom)
  const insets = useSafeAreaInsets()
  return (
    <YStack
      position="absolute"
      b={24 + insets.bottom}
      l={16}
      r={16}
      gap="2"
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </YStack>
  )
}
