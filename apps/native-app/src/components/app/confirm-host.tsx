import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import {
  clearConfirmsAtom,
  confirmQueueAtom,
  settleConfirmAtom,
} from "../../atoms/confirm.ts"
import { evoluCounterAtom } from "../../atoms/evolu-counter.ts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog.tsx"

/**
 * Shows the head of the queue; mount once inside the providers. As web's
 * `ConfirmDialogHost`: Cancel (outline) and Confirm (solid destructive when
 * the request asks for it), both `lg`; back settles with false.
 */
export function ConfirmHost() {
  const head = useAtomValue(confirmQueueAtom)[0]
  const settle = useSetAtom(settleConfirmAtom)
  const clear = useSetAtom(clearConfirmsAtom)
  const accountVersion = useAtomValue(evoluCounterAtom)

  // Pending requests belong to the account that asked: settle them with false
  // on an account switch (counter bump) and on unmount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: accountVersion is the trigger
  useEffect(() => clear, [accountVersion, clear])

  return (
    <AlertDialog
      open={head !== undefined}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
    >
      {head === undefined ? null : (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{head.title}</AlertDialogTitle>
            {typeof head.description === "string" ? (
              <AlertDialogDescription>
                {head.description}
              </AlertDialogDescription>
            ) : (
              head.description
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              size="lg"
              label={head.cancelLabel}
              onPress={() => settle(false)}
            />
            <AlertDialogAction
              size="lg"
              label={head.confirmLabel}
              onPress={() => settle(true)}
              {...(head.variant === "destructive"
                ? {
                    bg: "destructive hover:destructive-90 press:destructive-90",
                    labelColor: "destructive-foreground",
                  }
                : {})}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
