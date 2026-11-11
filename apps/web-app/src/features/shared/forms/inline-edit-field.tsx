import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { CheckIcon, XIcon } from "lucide-react"
import type { InputHTMLAttributes, ReactNode } from "react"
import { useId, useReducer, useRef } from "react"
import { flushSync } from "react-dom"
import { z } from "zod"
import { Button } from "@/components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import {
  type InlineEditAction,
  inlineEditInitialState,
  inlineEditReducer,
  inlineEditStartedState,
} from "@/features/shared/forms/inline-edit-field-state.ts"
import {
  InlineEditSavedTick,
  type InlineSaveResult,
  useInlineSave,
} from "@/features/shared/forms/inline-edit-save.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

/**
 * What currently sits inside the input's right edge. The four are mutually
 * exclusive, and each needs the matching right padding so the text does not
 * run under it.
 */
type InlineEditAdornment = "actions" | "tick" | "trailing" | "none"

const adornmentPadding = {
  actions: "pr-17",
  tick: "pr-9",
  trailing: "pr-12",
  none: "",
} satisfies Record<InlineEditAdornment, string>

interface InlineEditFieldProps<T extends string | number | null> {
  readonly label: string
  /**
   * Keeps `label` as the accessible name but takes it off screen, for a
   * field whose surroundings already say what it is — a row in a list.
   */
  readonly hideLabel?: boolean
  /**
   * Mounts the field already in edit mode and focused, for a caller that
   * renders it only in response to an explicit "edit this" action. The focus
   * is then held from the start, not from the first keystroke.
   */
  readonly startEditing?: boolean
  /** A function gets the text on screen, for a hint that follows the typing. */
  readonly description?: ReactNode | ((draft: string) => ReactNode)
  readonly placeholder?: string
  /** Only the native pickers we actually use; the codec handles the value. */
  readonly type?: "text" | "date"
  readonly inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"]
  /** Current stored value. Re-renders flow straight through while idle. */
  readonly defaultValue: T
  /**
   * Bridges the text the `<input>` holds and the stored value: `encode` for
   * display, `decode` for saving, with the validation in between. Must be a
   * `z.codec(z.string(), ...)` — a one-way transform schema satisfies this
   * type but throws on `encode`. (Zod's `ZodCodec` type is too invariant to
   * infer `T` through, hence the looser annotation.)
   */
  readonly codec: z.core.$ZodType<T, string>
  /**
   * Shown when `decode` rejects; Zod's own messages are untranslated. A
   * function picks the message by the text refused, for a field that can be
   * wrong in more than one way (a discount of zero against a malformed
   * amount).
   */
  readonly errorKey: TranslationKey | ((draft: string) => TranslationKey)
  /**
   * Control shown inside the input while it is idle, for a field with a
   * second way to fill it in (the catalog item's barcode scanner). It is
   * hidden during an edit, where the confirm and discard buttons sit.
   */
  readonly trailing?: ReactNode
  /**
   * Control rendered beside the label — the bank account field's IBAN /
   * account-number switch. Hidden while editing or saving, with its space
   * reserved so the input stays in place.
   */
  readonly labelAction?: (edit: { readonly draft: string }) => ReactNode
  /**
   * Resolves a `TranslationKey` for a refusal it explains (the toast says
   * it) or rejects for an unexpected failure (the generic toast); either
   * way the field shows no tick.
   */
  readonly onSave: (value: T) => InlineSaveResult
  /**
   * Called once the field is back to idle, whether the edit was saved or
   * discarded. For a caller that mounts the field only while editing.
   */
  readonly onEditFinished?: () => void
}

/**
 * A single field that saves itself.
 *
 * The first keystroke puts it in edit mode: confirm and discard buttons
 * appear inside the input, `Enter` saves, `Escape` discards. Edit mode is
 * modal — the field refuses to give up focus and blinks instead, so an
 * unfinished change cannot be left behind by clicking elsewhere — and a
 * refused click surfaces the validation error, so the blink is never the
 * only explanation. Finishing it either way releases the focus.
 *
 * A save keeps the entered text on screen until `onSave` resolves, then
 * hands the field back to `defaultValue` and shows a tick for a moment.
 *
 * `InlineEditState` holds the whole of that; see its reducer for the rules.
 */
export function InlineEditField<T extends string | number | null>({
  label,
  hideLabel,
  startEditing,
  description,
  placeholder,
  type,
  inputMode,
  defaultValue,
  codec,
  errorKey,
  trailing,
  labelAction,
  onSave,
  onEditFinished,
}: InlineEditFieldProps<T>) {
  const { t } = useTranslation()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  // Idle means the field follows `defaultValue`, so a row changed elsewhere
  // (another device syncing) shows up on its own without an effect re-seeding
  // local state — and without overwriting an edit in progress.
  const [state, dispatch] = useReducer(inlineEditReducer, null, () =>
    startEditing === true
      ? inlineEditStartedState(z.encode(codec, defaultValue))
      : inlineEditInitialState
  )
  const { justSaved, save } = useInlineSave(onSave)

  const editing = state.status === "editing"
  const value =
    state.status === "idle" ? z.encode(codec, defaultValue) : state.draft
  const saving = state.status === "saving"

  const adornment = ((): InlineEditAdornment => {
    if (editing) return "actions"
    if (saving) return "none"
    if (justSaved) return "tick"
    return trailing === undefined ? "none" : "trailing"
  })()

  /**
   * Leaves edit mode and hands the focus back. The dispatch has to land
   * before `blur()`, or the blur handler still sees the edit as unfinished
   * and refuses it.
   */
  const closeAndBlur = (action: InlineEditAction) => {
    flushSync(() => {
      dispatch(action)
    })
    inputRef.current?.blur()
  }

  const discard = () => {
    closeAndBlur({ type: "discard" })
    onEditFinished?.()
  }

  const commit = async () => {
    if (state.status !== "editing") return

    const parsed = z.safeDecode(codec, state.draft)
    if (!parsed.success) {
      dispatch({ type: "reject" })
      return
    }

    if (parsed.data === defaultValue) {
      discard()
      return
    }

    // The draft stays on screen until the save lands, so `onEditFinished`
    // waits with it rather than closing over a half-written row.
    closeAndBlur({ type: "commit" })
    await save(parsed.data)
    dispatch({ type: "settle" })
    onEditFinished?.()
  }

  /** Keeps a click on the buttons from blurring the input at all. */
  const keepFocus = (event: { preventDefault: () => void }) => {
    event.preventDefault()
  }

  return (
    <Field data-invalid={editing && state.invalid}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel
          htmlFor={id}
          className={hideLabel === true ? "sr-only" : ""}
        >
          {label}
        </FieldLabel>
        {labelAction !== undefined && (
          // biome-ignore lint/a11y/noStaticElementInteractions: only keeps the input's focus; the control inside handles its own interaction
          <div
            onMouseDown={keepFocus}
            className={cn(state.status !== "idle" && "invisible")}
          >
            {labelAction({
              draft: value,
            })}
          </div>
        )}
      </div>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          className={cn(
            adornmentPadding[adornment],
            editing && state.blinking && "animate-input-blink"
          )}
          value={value}
          aria-invalid={editing && state.invalid}
          autoComplete="off"
          autoFocus={startEditing}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          readOnly={saving}
          onChange={(event) => {
            dispatch({ type: "edit", draft: event.currentTarget.value })
          }}
          onBlur={() => {
            if (state.status !== "editing") return
            // Switching window or tab blurs the input too, and yanking the
            // focus back when the user returns would be hostile.
            if (!document.hasFocus()) return

            // The blink says the edit is unfinished; if it is unfinished
            // because it cannot be saved at all, say that too.
            dispatch({
              type: "refuseBlur",
              invalid: !z.safeDecode(codec, state.draft).success,
            })
            // A frame later the outgoing focus has settled, so this wins
            // over whatever the click focused.
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          onAnimationEnd={() => {
            dispatch({ type: "blinkEnd" })
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void commit()
            if (event.key === "Escape") discard()
          }}
        />
        {adornment === "actions" && (
          <div className="absolute inset-y-0 right-0 flex items-center gap-0.5">
            <Button
              type="button"
              size="icon"
              aria-label={t("inlineEdit.save")}
              onMouseDown={keepFocus}
              onClick={() => {
                void commit()
              }}
            >
              <CheckIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("inlineEdit.discard")}
              onMouseDown={keepFocus}
              onClick={discard}
            >
              <XIcon />
            </Button>
          </div>
        )}
        {adornment === "trailing" && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {trailing}
          </div>
        )}
        {adornment === "tick" && <InlineEditSavedTick className="right-2.5" />}
      </div>
      {description !== undefined && (
        <FieldDescription>
          {typeof description === "function" ? description(value) : description}
        </FieldDescription>
      )}
      <FieldError>
        {editing && state.invalid
          ? t(typeof errorKey === "function" ? errorKey(state.draft) : errorKey)
          : null}
      </FieldError>
    </Field>
  )
}
