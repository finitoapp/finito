import type { LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { ActivityIndicator } from "react-native"
import {
  createStyledContext,
  type GetProps,
  isWeb,
  styled,
  Text,
  useTheme,
} from "tamagui"
import {
  ButtonFrame as ButtonBehaviorFrame,
  type ButtonBehaviorProps,
  useButton,
} from "tamagui/unstyled"
import type { ThemeColor } from "../../theme/themes.ts"
import { control, fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import { Icon } from "./icon.tsx"
import {
  type PressFillColors,
  pressFillClause,
  useFastTransition,
} from "./press-fill.tsx"

/**
 * Web `apps/web-app/src/components/ui/button.tsx`: the same `variant` and
 * `size` names and defaults, as a `styled()` frame and text sharing a styled
 * context, drawn in fazole.fit's shapes (Linky's `packages/ui/src/controls.tsx`
 * `Button`/`IconButton`): a 12-round, borderless control 44 high (`lg` 56,
 * `sm` a 32 pill), `px-4 gap-2`, a bold 14 label and 20 icons; icon-only
 * sizes are pills. Built on Tamagui's unstyled button (`tamagui/unstyled`),
 * which on web renders a real `<button>` that takes focus and the keyboard,
 * rather than the styled `Button` from `tamagui`, whose own sizes, `level2`
 * theme and icon theming would fight these variants. That skin's
 * `web:pointer` cursor is the one part kept.
 *
 * Variants on fazole's: `default` the accent (`primary`), `secondary` the
 * raised surface, `outline` and `ghost` the neutral fill (always for
 * `outline`, pressed for `ghost`), `destructive` the danger tint, `link`
 * bare text. Web's `hover:` fill is both a `hover:` clause, for a pointer,
 * and a `press:` one, for touch; every size reaches 48 through `hitSlop`;
 * `link` dims instead of underlining.
 *
 * The fill is `fills`, carried by the frame itself as a flat clause
 * (`primary hover:primary-pressed press:primary-pressed`) on Tamagui's
 * `fast` transition on both platforms (`press-fill.tsx`).
 */

type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"

type TextSize = "default" | "xs" | "sm" | "lg"
type IconSize = "icon" | "icon-xs" | "icon-sm" | "icon-lg"
type ButtonSize = TextSize | IconSize

const ButtonContext = createStyledContext<{
  variant: ButtonVariant
  size: ButtonSize
}>({ variant: "default", size: "default" })

const ButtonFrame = styled(ButtonBehaviorFrame, {
  name: "Button",
  context: ButtonContext,
  flexDirection: "row",
  items: "center",
  justify: "center",
  cursor: "web:pointer",
  // A real `<button>` on web, whose default is an outset border.
  ...(isWeb ? { borderWidth: 0 } : {}),

  variants: {
    variant: {
      default: {},
      outline: {},
      secondary: {},
      ghost: {},
      destructive: {},
      link: { bg: "transparent", opacity: "1 hover:0.7 press:0.7" },
    },
    size: {
      default: { minH: control.md, px: 16, py: 10, gap: 8 },
      xs: { minH: 28, px: 10, gap: 4 },
      sm: { minH: control.sm, px: 12, py: 4, gap: 6 },
      lg: { minH: control.lg, px: 16, py: 12, gap: 8 },
      icon: { w: control.md, h: control.md },
      "icon-xs": { w: 28, h: 28 },
      "icon-sm": { w: control.sm, h: control.sm },
      "icon-lg": { w: control.lg, h: control.lg },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,

  defaultVariants: { variant: "default", size: "default" },
})

/** Each variant's fill at rest and pressed (or hovered, on web). */
const fills = {
  default: { rest: "primary", pressed: "primary-pressed" },
  outline: { rest: "button-outline", pressed: "button-outline-pressed" },
  secondary: { rest: "surface-raised", pressed: "button-outline-pressed" },
  ghost: { rest: "transparent", pressed: "button-ghost-pressed" },
  destructive: {
    rest: "destructive-tint",
    pressed: "destructive-tint-pressed",
  },
} as const satisfies Record<Exclude<ButtonVariant, "link">, PressFillColors>

/** A control is 12 round; the small sizes and icon buttons are pills. */
const radii = {
  default: shape.control,
  xs: shape.pill,
  sm: shape.pill,
  lg: shape.control,
  icon: shape.pill,
  "icon-xs": shape.pill,
  "icon-sm": shape.pill,
  "icon-lg": shape.pill,
} as const satisfies Record<ButtonSize, number>

const textColors = {
  default: "primary-foreground",
  outline: "color",
  secondary: "secondary-foreground",
  ghost: "color",
  destructive: "destructive",
  link: "primary",
} as const satisfies Record<ButtonVariant, ThemeColor>

const ButtonText = styled(Text, {
  name: "ButtonText",
  context: ButtonContext,
  fontWeight: fontWeight.bold,
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
  text: "center",

  variants: {
    variant: {
      default: { color: textColors.default },
      outline: { color: textColors.outline },
      secondary: { color: textColors.secondary },
      ghost: { color: textColors.ghost },
      destructive: { color: textColors.destructive },
      link: { color: textColors.link },
    },
    size: {
      default: {},
      xs: { fontSize: fontSize.xs, lineHeight: fontSize.xs },
      sm: { fontSize: fontSize.xs, lineHeight: fontSize.xs },
      lg: {},
      icon: {},
      "icon-xs": {},
      "icon-sm": {},
      "icon-lg": {},
    },
  } as const,
})

/** fazole's icon sizes: 20 in a control, 16 in a small one, 24 in a large icon button. */
const iconSizes = {
  default: 20,
  xs: 14,
  sm: 16,
  lg: 20,
  icon: 20,
  "icon-xs": 14,
  "icon-sm": 16,
  "icon-lg": 24,
} as const satisfies Record<ButtonSize, number>

/** Extends each size's hit area to 48, the Android touch target. */
const hitSlops = {
  default: 2,
  xs: 10,
  sm: 8,
  lg: 0,
  icon: 2,
  "icon-xs": 10,
  "icon-sm": 8,
  "icon-lg": 0,
} as const satisfies Record<ButtonSize, number>

type FrameProps = Omit<
  GetProps<typeof ButtonFrame>,
  | "children"
  | "variant"
  | "size"
  | "disabled"
  | "onPress"
  | "rounded"
  | "bg"
  | "backgroundColor"
>

interface ButtonBaseProps extends FrameProps {
  readonly variant?: ButtonVariant
  /** The corner radius, a number. Defaults to the size's. */
  readonly rounded?: number
  /**
   * Replaces the variant's fill, for the few web call sites that recolor a
   * button with a class (`bg-background/60 hover:bg-background`).
   */
  readonly fillColors?: PressFillColors
  /** Already translated; or pass `children`. */
  readonly label?: string
  readonly children?: ReactNode
  readonly iconStart?: LucideIcon
  readonly iconEnd?: LucideIcon
  /** Replaces `iconStart` with a spinner and blocks presses. */
  readonly pending?: boolean
  readonly disabled?: boolean
  readonly onPress?: () => void
  /**
   * Recolors the label and icons, for the few web call sites that recolor a
   * button with a class (the destructive confirm in `ui/alert-dialog`).
   */
  readonly labelColor?: ThemeColor
}

/** An icon-only button has no text TalkBack could read, so it must be named. */
export type ButtonProps = ButtonBaseProps &
  (
    | { readonly size?: TextSize; readonly "aria-label"?: string }
    | { readonly size: IconSize; readonly "aria-label": string }
  )

export function Button({
  variant = "default",
  size = "default",
  label,
  children,
  iconStart,
  iconEnd,
  pending = false,
  disabled = false,
  onPress,
  "aria-label": ariaLabel,
  labelColor,
  rounded = radii[size],
  fillColors,
  onPressIn,
  onPressOut,
  ...frameProps
}: ButtonProps) {
  const theme = useTheme()
  // Not a parameter default: React Compiler cannot compile a component
  // whose parameter defaults to a conditional.
  const fill = fillColors ?? (variant === "link" ? undefined : fills[variant])
  const inactive = disabled || pending
  const color = labelColor ?? textColors[variant]
  const iconSize = iconSizes[size]
  const content = label ?? children
  const transition = useFastTransition()
  // On web: a `<button>`, `disabled` and out of the tab order while inactive,
  // and an inert `<span>` (no role, no press handlers) when nested in another
  // button.
  const { props: buttonProps } = useButton<
    ButtonBehaviorProps &
      Pick<
        GetProps<typeof ButtonFrame>,
        "role" | "onPress" | "onPressIn" | "onPressOut"
      >
  >({
    role: "button",
    onPress: inactive ? undefined : onPress,
    onPressIn,
    onPressOut,
    disabled: inactive,
    children: (
      <>
        {pending ? (
          <ActivityIndicator size={iconSize} color={theme[color]?.val} />
        ) : iconStart === undefined ? null : (
          <Icon icon={iconStart} size={iconSize} color={color} />
        )}
        {typeof content === "string" ? (
          <ButtonText
            numberOfLines={1}
            {...(labelColor === undefined ? {} : { color: labelColor })}
          >
            {content}
          </ButtonText>
        ) : (
          content
        )}
        {iconEnd === undefined ? null : (
          <Icon icon={iconEnd} size={iconSize} color={color} />
        )}
      </>
    ),
  })
  return (
    <ButtonFrame
      {...frameProps}
      {...buttonProps}
      {...(fill === undefined ? {} : { bg: pressFillClause(fill) })}
      transition={transition}
      variant={variant}
      size={size}
      rounded={rounded}
      hitSlop={hitSlops[size]}
      aria-label={ariaLabel ?? label}
      aria-busy={pending}
    />
  )
}
