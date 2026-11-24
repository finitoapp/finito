import X from "lucide-react-native/icons/x"
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react"
import { BackHandler, Platform, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { styled, Text, View } from "tamagui"
import { Sheet } from "tamagui/unstyled"
import { isReduceMotionEnabled } from "../../platform/reduce-motion.ts"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import { Button } from "./button.tsx"

/**
 * Web `apps/web-app/src/components/ui/dialog.tsx`: `Dialog`,
 * `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`,
 * `DialogDescription`.
 *
 * Tailwind mirrored: content `gap-4 bg-popover p-4`; a ghost `icon-sm`
 * close button `top-2 right-2`; header `flex-col gap-2`; title `text-base
 * font-medium`; description `text-sm text-muted-foreground`; footer `-mx-4
 * -mb-4 flex-col-reverse gap-2 bg-muted/50 p-4` (the phone layout), without
 * web's top rule.
 *
 * Native difference: a bottom sheet, not web's centered card — Tamagui
 * `Sheet` sized to its content (`snapPointsMode="fit"`), 24-round top
 * corners and a grabber, dragged down or the overlay tapped to dismiss,
 * moving up with the keyboard; at most 640 wide, centered, on a tablet.
 * `ui/select` and `ui/combobox` open their lists in it too.
 *
 * Base: a modal `Sheet`, portalled to the root over `react-native-teleport`
 * (`platform/native-portal.ts`), which keeps the React contexts the content
 * reads. It is mounted from opening until it has slid out, so a reopened
 * dialog starts afresh. The hardware back button calls
 * `onOpenChange(false)` (`useCloseOnBackButton`); `dismissOnOverlayPress={false}`
 * also turns off dragging it away. The close button shows only when
 * `closeLabel` (the translated "Close") is given: the kit has no
 * translations of its own.
 */

interface DialogContextValue {
  readonly onOpenChange: (open: boolean) => void
}

/** Provided by `Dialog` and `AlertDialog` for the parts that close them. */
export const DialogContext = createContext<DialogContextValue>({
  onOpenChange: () => {},
})

/** The enclosing dialog's `onOpenChange`, for parts that close it. */
export const useDialog = () => useContext(DialogContext)

export interface DialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly children: ReactNode
  /** False while the dialog must not be dismissed by a tap or a drag. */
  readonly dismissOnOverlayPress?: boolean
}

const sheetSpring = {
  type: "spring",
  damping: 20,
  mass: 1.2,
  stiffness: 250,
} as const
const noMotion = { type: "timing", duration: 0 } as const

/**
 * Longest a closed sheet waits to report it has slid out before it is
 * unmounted anyway, so its content cannot outlive it into the next opening.
 */
const CLOSE_FALLBACK_MS = 1000

/**
 * Android's back button calls `close` while `open`, as an RN `Modal`'s
 * `onRequestClose` did. Registered on opening only, so the newest open
 * dialog (an alert over a sheet) is the first to hear it.
 */
export function useCloseOnBackButton(open: boolean, close: () => void) {
  const onBack = useEffectEvent(() => {
    close()
    return true
  })
  useEffect(() => {
    // react-native-web's BackHandler only warns that it is unsupported.
    if (!open || Platform.OS === "web") return
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBack
    )
    return () => subscription.remove()
  }, [open])
}

export function Dialog({
  open,
  onOpenChange,
  children,
  dismissOnOverlayPress = true,
}: DialogProps) {
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  // Read once per mount, as `ui/switch`: the React Native driver ignores
  // the system's reduce-motion setting.
  const [reduceMotion] = useState(isReduceMotionEnabled)

  useEffect(() => {
    if (open) return
    const timer = setTimeout(() => setMounted(false), CLOSE_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [open])

  useCloseOnBackButton(open, () => onOpenChange(false))

  if (!mounted) return null
  return (
    <DialogContext value={{ onOpenChange }}>
      <Sheet
        modal
        open={open}
        onOpenChange={onOpenChange}
        snapPointsMode="fit"
        dismissOnSnapToBottom
        dismissOnOverlayPress={dismissOnOverlayPress}
        disableDrag={!dismissOnOverlayPress}
        moveOnKeyboardChange
        transitionConfig={reduceMotion ? noMotion : sheetSpring}
        onTransition={(event) => {
          if (
            event.phase === "end" &&
            event.cause === "close" &&
            event.finished !== false
          )
            setMounted(false)
        }}
      >
        <Sheet.Overlay
          bg="rgba(0,0,0,0.5)"
          opacity="1 enter:0 exit:0"
          transition={reduceMotion ? undefined : "fast"}
        />
        <Sheet.Container
          w="100%"
          maxW={640}
          self="center"
          bg="popover"
          borderTopLeftRadius={shape.sheet}
          borderTopRightRadius={shape.sheet}
          pb={insets.bottom}
          aria-modal
        >
          <View
            self="center"
            mt={8}
            w={36}
            h={4}
            rounded={2}
            bg="muted-foreground"
            opacity={0.4}
          />
          {children}
        </Sheet.Container>
      </Sheet>
    </DialogContext>
  )
}

export function DialogContent({
  children,
  closeLabel,
}: {
  readonly children: ReactNode
  readonly closeLabel?: string
}) {
  const { onOpenChange } = useDialog()
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  return (
    <>
      <Sheet.ScrollView
        // Leaves the status bar and a strip of the screen above the sheet.
        maxH={height * 0.9 - insets.top}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        {children}
      </Sheet.ScrollView>
      {closeLabel === undefined ? null : (
        <View position="absolute" t={8} r={8}>
          <Button
            variant="ghost"
            size="icon-sm"
            iconStart={X}
            aria-label={closeLabel}
            onPress={() => onOpenChange(false)}
          />
        </View>
      )}
    </>
  )
}

export const DialogHeader = styled(View, { name: "DialogHeader", gap: 8 })

export const DialogTitle = styled(Text, {
  name: "DialogTitle",
  role: "heading",
  fontSize: fontSize.base,
  lineHeight: fontSize.base,
  fontWeight: fontWeight.medium,
  color: "popover-foreground",
})

export const DialogDescription = styled(Text, {
  name: "DialogDescription",
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
  color: "muted-foreground",
})

export const DialogFooter = styled(View, {
  name: "DialogFooter",
  flexDirection: "column-reverse",
  gap: 8,
  mx: -16,
  mb: -16,
  p: 16,
  bg: "muted-50",
})
