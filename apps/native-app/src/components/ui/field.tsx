import {
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { type GetProps, styled, Text, View } from "tamagui"
import { control, fontSize, fontWeight, shape } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/ui/field.tsx`: the same parts, in
 * fazole.fit's field frame (Linky's `packages/ui/src/fields.tsx`
 * `FieldFrame`): a semibold 14 label in the subtle text color, the control,
 * and a 12 caption under it, muted for a description and in the danger
 * color for an error, `gap-1` between them; `FieldGroup` `gap-4`.
 *
 * Tailwind mirrored otherwise: `FieldSet` `flex-col gap-4`; `FieldLegend`
 * `mb-1.5 font-medium text-base` (`variant="label"` `text-sm`); `Field`
 * `flex-col` or (`horizontal`) `flex-row items-center`; `FieldContent`
 * `flex-1 flex-col gap-0.5`; `FieldError` has `role="alert"`;
 * `FieldSeparator` `h-5` with a centered rule.
 *
 * Native differences: web ties a label to its input with `htmlFor`; here
 * `Field` gives `FieldLabel` an `id` and `ui/input` names itself after it
 * with `aria-labelledby`, which TalkBack and a browser both read (React
 * Native's `nativeID`/`accessibilityLabelledBy` reach the DOM untranslated
 * through Tamagui). The input also takes the label's text as its
 * `aria-label`: a browser still names it by `aria-labelledby`, which wins,
 * but Maestro reads neither, only a label (the e2e flows find inputs so).
 * `orientation`
 * has no `responsive` value: a phone is always the narrow layout.
 *
 * Choice card: as on web, a `FieldLabel` around a `Field` is a card the
 * whole of which presses the control inside it (`ui/radio-group`'s
 * `RadioGroupItem`), which hands the card its state through
 * `useFieldLabelControl` where web's `<label htmlFor>` reaches its input.
 * Web draws `rounded-lg border p-2.5`, checked `bg-primary/5
 * border-primary/30`; here, without borders, a `surface-raised` fill,
 * checked the `primary-10` tint, 12 round, at least 56 high, 12 inside. The
 * card is the one element a screen reader reads, with the control's role and
 * checked state; the control inside it is hidden from it.
 */

interface FieldLabelContextValue {
  readonly id: string
  readonly text: string | undefined
  readonly setText: (text: string | undefined) => void
}

const FieldLabelContext = createContext<FieldLabelContextValue | undefined>(
  undefined
)

/** The `id` of the enclosing field's label, for `aria-labelledby`. */
export const useFieldLabelId = () => useContext(FieldLabelContext)?.id

/** The enclosing field's label text, when it is plain text, for `aria-label`. */
export const useFieldLabelText = () => useContext(FieldLabelContext)?.text

export const FieldSet = styled(View, { name: "FieldSet", gap: 16 })

export const FieldLegend = styled(Text, {
  name: "FieldLegend",
  mb: 6,
  fontWeight: fontWeight.medium,

  variants: {
    variant: {
      legend: { fontSize: fontSize.base, lineHeight: fontSize.base },
      label: { fontSize: fontSize.sm, lineHeight: fontSize.sm },
    },
  } as const,

  defaultVariants: { variant: "legend" },
})

export const FieldGroup = styled(View, { name: "FieldGroup", gap: 16 })

const FieldFrame = styled(View, {
  name: "Field",
  gap: 4,

  variants: {
    orientation: {
      vertical: { flexDirection: "column" },
      horizontal: { flexDirection: "row", items: "center" },
    },
  } as const,

  defaultVariants: { orientation: "vertical" },
})

export function Field({
  children,
  ...props
}: GetProps<typeof FieldFrame> & { readonly children?: ReactNode }) {
  const id = useId()
  const [text, setText] = useState<string>()
  return (
    <FieldLabelContext value={{ id, text, setText }}>
      <FieldFrame {...props}>{children}</FieldFrame>
    </FieldLabelContext>
  )
}

export const FieldContent = styled(View, {
  name: "FieldContent",
  flex: 1,
  gap: 2,
})

const FieldLabelText = styled(Text, {
  name: "FieldLabel",
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
  fontWeight: fontWeight.semibold,
  color: "foreground-70",
})

/** What a control inside a choice card tells the card about itself. */
export interface FieldLabelControl {
  readonly role: "radio" | "checkbox"
  readonly checked: boolean
  readonly disabled: boolean
  readonly onPress: () => void
}

const FieldLabelControlContext = createContext<
  ((control: FieldLabelControl | undefined) => void) | undefined
>(undefined)

/**
 * Hands the choice card around a control its state and press, as web's
 * `<label>` forwards a click to its control. Returns whether the control is
 * in a card, which then draws the press target and reads it to screen readers.
 */
export function useFieldLabelControl({
  role,
  checked,
  disabled,
  onPress,
}: FieldLabelControl): boolean {
  const register = useContext(FieldLabelControlContext)
  const onPressRef = useRef(onPress)
  useEffect(() => {
    onPressRef.current = onPress
  })
  useEffect(() => {
    register?.({ role, checked, disabled, onPress: () => onPressRef.current() })
  }, [register, role, checked, disabled])
  useEffect(
    () => (register === undefined ? undefined : () => register(undefined)),
    [register]
  )
  return register !== undefined
}

const FieldLabelCardFrame = styled(View, {
  name: "FieldLabelCard",
  minH: control.lg,
  justify: "center",
  px: 12,
  py: 10,
  rounded: shape.control,
  transition: "fast",
  bg: "surface-raised hover:neutral-soft press:neutral-soft",
  cursor: "web:pointer",

  variants: {
    checked: { true: { bg: "primary-10 hover:primary-15 press:primary-15" } },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

function FieldLabelCard({ children }: { readonly children: ReactNode }) {
  const [control, setControl] = useState<FieldLabelControl>()
  const checked = control?.checked ?? false
  const disabled = control?.disabled ?? false
  return (
    <FieldLabelControlContext value={setControl}>
      <FieldLabelCardFrame
        checked={checked}
        disabled={disabled}
        onPress={disabled ? undefined : control?.onPress}
        role={control?.role}
        aria-checked={checked}
        aria-disabled={disabled}
      >
        {children}
      </FieldLabelCardFrame>
    </FieldLabelControlContext>
  )
}

export function FieldLabel(props: GetProps<typeof FieldLabelText>) {
  const field = useContext(FieldLabelContext)
  const text = typeof props.children === "string" ? props.children : undefined
  const setText = field?.setText
  useEffect(() => {
    setText?.(text)
  }, [setText, text])
  // Web's `has-[>[data-slot=field]]`: a label around a field is a card.
  if (isValidElement(props.children) && props.children.type === Field)
    return <FieldLabelCard>{props.children}</FieldLabelCard>
  return <FieldLabelText id={field?.id} {...props} />
}

export const FieldTitle = styled(Text, {
  name: "FieldTitle",
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
  fontWeight: fontWeight.medium,
})

export const FieldDescription = styled(Text, {
  name: "FieldDescription",
  fontSize: fontSize.xs,
  lineHeight: fontSize.xs,
  color: "muted-foreground",
})

const FieldErrorText = styled(Text, {
  name: "FieldError",
  fontSize: fontSize.xs,
  lineHeight: fontSize.xs,
  color: "destructive",
})

/** Renders nothing without `children` or a message in `errors`. */
export function FieldError({
  children,
  errors,
  ...props
}: Omit<GetProps<typeof FieldErrorText>, "children"> & {
  readonly children?: string
  readonly errors?: ReadonlyArray<{ readonly message?: string } | undefined>
}) {
  const messages =
    children === undefined
      ? [
          ...new Set(
            (errors ?? []).flatMap((error) =>
              error?.message === undefined ? [] : [error.message]
            )
          ),
        ]
      : [children]
  if (messages.length === 0) return null
  return (
    <FieldErrorText role="alert" aria-live="polite" {...props}>
      {messages.join("\n")}
    </FieldErrorText>
  )
}

const FieldSeparatorFrame = styled(View, {
  name: "FieldSeparator",
  h: 20,
  my: -8,
  justify: "center",
})

export function FieldSeparator({ children }: { readonly children?: string }) {
  return (
    <FieldSeparatorFrame>
      <View position="absolute" l={0} r={0} h={1} bg="border-color" />
      {children === undefined ? null : (
        <Text
          self="center"
          px={8}
          bg="background"
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {children}
        </Text>
      )}
    </FieldSeparatorFrame>
  )
}
