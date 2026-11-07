import X from "lucide-react-native/icons/x"
import { createContext, type ReactNode, useContext } from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { styled, Text, View } from "tamagui"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import { Button } from "./button.tsx"

/**
 * Web `apps/web-app/src/components/ui/dialog.tsx`: `Dialog`,
 * `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`,
 * `DialogDescription`.
 *
 * Tailwind mirrored: content `max-w-[calc(100%-2rem)] sm:max-w-sm gap-4
 * bg-popover p-4`, as fazole.fit's sheet: 24 round and without web's ring;
 * a ghost `icon-sm` close button `top-2 right-2`; header `flex-col gap-2`;
 * title `text-base font-medium`; description `text-sm
 * text-muted-foreground`; footer `-mx-4 -mb-4 flex-col-reverse gap-2
 * bg-muted/50 p-4` (the phone layout), without web's top rule.
 *
 * Base: RN `Modal` (transparent, fade, `statusBarTranslucent`), which the
 * confirm host and the table picker already use on the device; Tamagui
 * `Dialog` has not been tried there. The hardware back button and a tap on
 * the overlay call `onOpenChange(false)`. The overlay is a plain
 * `rgba(0,0,0,0.5)` (web: `bg-black/10 backdrop-blur-xs`, which has no
 * native blur). Long content scrolls inside the card, and the card moves
 * up with the keyboard. The close button shows only when `closeLabel` (the
 * translated "Close") is given: the kit has no translations of its own.
 */

interface DialogContextValue {
  readonly onOpenChange: (open: boolean) => void
}

const DialogContext = createContext<DialogContextValue>({
  onOpenChange: () => {},
})

/** The enclosing dialog's `onOpenChange`, for parts that close it. */
export const useDialog = () => useContext(DialogContext)

export interface DialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly children: ReactNode
  /** False for an alert dialog, which an overlay tap must not dismiss. */
  readonly dismissOnOverlayPress?: boolean
}

export function Dialog({
  open,
  onOpenChange,
  children,
  dismissOnOverlayPress = true,
}: DialogProps) {
  const insets = useSafeAreaInsets()
  return (
    <DialogContext value={{ onOpenChange }}>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => onOpenChange(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View
            flex={1}
            justify="center"
            items="center"
            pt={16 + insets.top}
            pr={16 + insets.right}
            pb={16 + insets.bottom}
            pl={16 + insets.left}
          >
            <Pressable
              accessible={false}
              onPress={
                dismissOnOverlayPress ? () => onOpenChange(false) : undefined
              }
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
            />
            {children}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </DialogContext>
  )
}

const ContentFrame = styled(View, {
  name: "DialogContent",
  w: "100%",
  maxW: 384,
  maxH: "100%",
  rounded: shape.sheet,
  bg: "popover",
  overflow: "hidden",
})

export function DialogContent({
  children,
  closeLabel,
}: {
  readonly children: ReactNode
  readonly closeLabel?: string
}) {
  const { onOpenChange } = useDialog()
  return (
    <ContentFrame aria-modal>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
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
    </ContentFrame>
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
