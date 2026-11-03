import { useTimeoutFn } from "@dedalik/use-react"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { CheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

/** How long the tick stays up. Applied to the animation, so the two cannot drift. */
export const SAVED_INDICATOR_MS = 1600

interface InlineSave<T> {
  /** True while the tick should be on screen. */
  readonly justSaved: boolean
  /** Settles either way; the caller learns nothing beyond "it is over". */
  readonly save: (value: T) => Promise<void>
}

type InlineSaveResult = Promise<void> | Promise<TranslationKey | undefined>

/**
 * The save half every inline-edit control shares: run `onSave`, toast when
 * it rejects, and show the tick only when it did not.
 *
 * It deliberately keeps no "saving" flag. Both controls already hold the
 * value they are saving, so they know it from their own state, and a second
 * copy here would be one more thing to keep in step.
 */
export const useInlineSave = <T,>(
  onSave: (value: T) => InlineSaveResult
): InlineSave<T> => {
  const { t } = useTranslation()
  // `pending` is the whole point here: it is true for as long as the tick
  // should stay up, and a second save restarts it.
  const { pending: justSaved, start: flashSaved } = useTimeoutFn(() => {
    // The indicator is `pending` itself; nothing to do when it expires.
  }, SAVED_INDICATOR_MS)

  const save = async (value: T) => {
    try {
      const errorKey = await onSave(value)
      if (errorKey !== undefined) {
        toast.error(t(errorKey))
        return
      }
      flashSaved()
    } catch {
      toast.error(t("app.saveFailed"))
    }
  }

  return { justSaved, save }
}

/**
 * The save half of a control that commits the moment it is touched — a
 * select, a checkbox, a toggle group. Picking is the confirmation, so there
 * is no draft to keep; the only state is the value in flight, which stays on
 * screen until the save lands so the control never flashes the stored one
 * back while Evolu catches up.
 */
export const useInlineChoice = <T,>(
  defaultValue: T,
  onSave: (value: T) => InlineSaveResult
) => {
  const { justSaved, save } = useInlineSave(onSave)
  // Boxed, because `null` and `false` are values a control can legitimately
  // be saving and "nothing in flight" has to stay distinguishable from them.
  const [inFlight, setInFlight] = useState<readonly [T] | null>(null)

  const choose = async (next: T) => {
    if (next === defaultValue) return

    setInFlight([next])
    await save(next)
    setInFlight(null)
  }

  return {
    value: inFlight === null ? defaultValue : inFlight[0],
    saving: inFlight !== null,
    justSaved,
    choose,
  }
}

/**
 * The tick a control shows after a save. Its animation fades itself back
 * out before the caller unmounts it, so it never disappears in one frame.
 */
export function InlineEditSavedTick({
  className,
}: {
  readonly className?: string
}) {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      aria-label={t("inlineEdit.saved")}
      // Overrides the duration the `--animate-saved-tick` shorthand sets, so
      // the fade-out lands exactly as the timer unmounts this.
      style={{ animationDuration: `${SAVED_INDICATOR_MS}ms` }}
      className={cn(
        "pointer-events-none absolute inset-y-0 flex animate-saved-tick items-center text-success",
        className
      )}
    >
      <CheckIcon className="size-5" />
    </div>
  )
}
