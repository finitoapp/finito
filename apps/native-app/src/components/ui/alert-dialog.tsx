import type { ReactNode } from "react"
import { styled, Text, View } from "tamagui"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import { Button, type ButtonProps } from "./button.tsx"
import { Dialog, useDialog } from "./dialog.tsx"

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
 * Built on `ui/dialog`'s RN `Modal`: an overlay tap does not dismiss it, the
 * hardware back button calls `onOpenChange(false)`. Unlike web, where both
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
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissOnOverlayPress={false}
    >
      {children}
    </Dialog>
  )
}

export const AlertDialogContent = styled(View, {
  name: "AlertDialogContent",
  role: "alertdialog",
  "aria-modal": true,
  w: "100%",
  maxW: 512,
  gap: 16,
  p: 24,
  // fazole.fit's sheet: 24 round, no border.
  rounded: shape.sheet,
  bg: "popover",
})

export const AlertDialogHeader = styled(View, {
  name: "AlertDialogHeader",
  gap: 8,
})

export const AlertDialogTitle = styled(Text, {
  name: "AlertDialogTitle",
  role: "heading",
  text: "center",
  fontSize: fontSize.lg,
  lineHeight: fontSize.lg,
  fontWeight: fontWeight.semibold,
})

export const AlertDialogDescription = styled(Text, {
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
