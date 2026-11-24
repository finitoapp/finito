import type { ReactNode } from "react"
import { type GetProps, styled, View } from "tamagui"
import { AlertDialog as TamaguiAlertDialog } from "tamagui/unstyled"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import { Button, type ButtonProps } from "./button.tsx"
import { DialogContext, useCloseOnBackButton, useDialog } from "./dialog.tsx"
import { useKitTransition } from "./press-fill.tsx"

/**
 * Web `apps/web-app/src/components/ui/alert-dialog.tsx`: `AlertDialog`,
 * `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`,
 * `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`,
 * `AlertDialogCancel`.
 *
 * Tailwind mirrored: overlay `bg-black/50`; content `max-w-[calc(100%-2rem)]
 * sm:max-w-lg gap-4 rounded-lg border bg-background p-6`; header `flex-col
 * gap-2 text-center` (the phone layout); title `text-lg font-semibold`;
 * description `text-sm text-muted-foreground`; footer `flex-col-reverse
 * gap-2`; Action a default button, Cancel an outline one.
 *
 * Base: Tamagui `AlertDialog`, portalled to the root as `ui/dialog`'s sheet
 * (`platform/native-portal.ts`), a centered card where `ui/dialog` is a
 * bottom sheet: the overlay fades in and the card fades and grows in on the
 * `fast` transition, an overlay tap does not dismiss it, the hardware back
 * button calls `onOpenChange(false)`; Title and Description name and
 * describe it to a screen reader. Unlike web, where both
 * buttons are `Close` primitives, Action only runs its `onPress`: the owner
 * decides whether that closes the dialog, so a queue (the confirm host) can
 * settle one request without also cancelling the next. Cancel without an
 * `onPress` calls `onOpenChange(false)`.
 */

export function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly children: ReactNode
}) {
  const transition = useKitTransition("fast")
  useCloseOnBackButton(open, () => onOpenChange(false))
  return (
    <DialogContext value={{ onOpenChange }}>
      <TamaguiAlertDialog open={open} onOpenChange={onOpenChange}>
        <TamaguiAlertDialog.Portal p={16}>
          <TamaguiAlertDialog.Overlay
            key="overlay"
            position="absolute"
            t={0}
            r={0}
            b={0}
            l={0}
            bg="rgba(0,0,0,0.5)"
            opacity="1 enter:0 exit:0"
            transition={transition}
          />
          {children}
        </TamaguiAlertDialog.Portal>
      </TamaguiAlertDialog>
    </DialogContext>
  )
}

const AlertDialogContentFrame = styled(TamaguiAlertDialog.Content, {
  name: "AlertDialogContent",
  w: "100%",
  maxW: 512,
  gap: 16,
  p: 24,
  // fazole.fit's sheet: 24 round, no border.
  rounded: shape.sheet,
  bg: "popover",
  opacity: "1 enter:0 exit:0",
  scale: "1 enter:0.95 exit:0.95",
})

export function AlertDialogContent(
  props: GetProps<typeof AlertDialogContentFrame>
) {
  const transition = useKitTransition("fast")
  return (
    <AlertDialogContentFrame key="content" transition={transition} {...props} />
  )
}

export const AlertDialogHeader = styled(View, {
  name: "AlertDialogHeader",
  gap: 8,
})

export const AlertDialogTitle = styled(TamaguiAlertDialog.Title, {
  name: "AlertDialogTitle",
  role: "heading",
  text: "center",
  fontSize: fontSize.lg,
  lineHeight: fontSize.lg,
  fontWeight: fontWeight.semibold,
})

export const AlertDialogDescription = styled(TamaguiAlertDialog.Description, {
  name: "AlertDialogDescription",
  text: "center",
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
  color: "muted-foreground",
})

export const AlertDialogFooter = styled(View, {
  name: "AlertDialogFooter",
  flexDirection: "column-reverse",
  gap: 8,
})

export function AlertDialogAction(props: ButtonProps) {
  return <Button {...props} />
}

export function AlertDialogCancel(props: ButtonProps) {
  const { onOpenChange } = useDialog()
  return (
    <Button
      variant="outline"
      {...props}
      onPress={props.onPress ?? (() => onOpenChange(false))}
    />
  )
}
