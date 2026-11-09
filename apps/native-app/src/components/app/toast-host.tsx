import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { isWeb } from "tamagui"
import {
  Toast as TamaguiToast,
  toast as tamaguiToast,
  useToastItem,
} from "tamagui/unstyled"
import {
  dismissToastAtom,
  type Toast as ToastData,
  toastOffset,
  toastsAtom,
} from "../../atoms/toast.ts"
import { isReduceMotionEnabled } from "../../platform/reduce-motion.ts"
import { menuBarHeight, useMenuBarTab } from "../menu-nav.tsx"
import { Toast } from "../ui/toast.tsx"

const DISMISS_AFTER_MS = 4000

/** One toast's look, closed through Tamagui so it slides out. */
function AppToast({ toast }: { readonly toast: ToastData }) {
  const { handleClose } = useToastItem()
  return (
    <Toast
      variant={toast.variant}
      message={toast.message}
      onPress={handleClose}
      action={
        toast.action === undefined
          ? undefined
          : {
              label: toast.action.label,
              onPress: () => {
                handleClose()
                toast.action?.onPress()
              },
            }
      }
    />
  )
}

/**
 * Mount once inside the Jotai Provider and TamaguiProvider. `toastsAtom` is
 * the inbox callers write to; each toast is handed to Tamagui's toaster
 * (its timing, stacking, enter/exit and swipe to dismiss) and leaves the
 * atom. The viewport renders in place, not through Tamagui's portal, which
 * on native would drop the app's React contexts.
 */
export function ToastHost() {
  const toasts = useAtomValue(toastsAtom)
  const dismiss = useSetAtom(dismissToastAtom)
  const insets = useSafeAreaInsets()
  const menuBarRoom = useMenuBarTab() === undefined ? 0 : menuBarHeight
  // Read once per mount: Tamagui's driver ignores the system setting.
  const [reducedMotion] = useState(isReduceMotionEnabled)

  useEffect(() => {
    for (const toast of toasts) {
      tamaguiToast.custom(() => <AppToast toast={toast} />, {
        id: toast.id,
        duration: DISMISS_AFTER_MS,
      })
      dismiss(toast.id)
    }
  }, [toasts, dismiss])

  return (
    <TamaguiToast
      position="bottom-center"
      duration={DISMISS_AFTER_MS}
      reducedMotion={reducedMotion}
    >
      <TamaguiToast.Viewport
        portalToRoot={false}
        offset={{ bottom: toastOffset, left: 16, right: 16 }}
        // Tamagui's `safe` edges need its own safe-area setup; give the
        // insets directly (web keeps its centered column).
        b={insets.bottom + menuBarRoom}
        {...(isWeb ? {} : { l: insets.left, r: insets.right })}
      >
        <TamaguiToast.List
          renderItem={({ toast, index }) => (
            <TamaguiToast.Item toast={toast} index={index}>
              {toast.jsx}
            </TamaguiToast.Item>
          )}
        />
      </TamaguiToast.Viewport>
    </TamaguiToast>
  )
}
