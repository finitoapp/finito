import type { LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { ActivityIndicator } from "react-native"
import {
  createStyledContext,
  type GetProps,
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
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"
import { Icon } from "./icon.tsx"

/**
 * Web `apps/web-app/src/components/ui/button.tsx`: the same `variant` and
 * `size` names and defaults, as a `styled()` frame and text sharing a styled
 * context. Built on Tamagui's unstyled button (`tamagui/unstyled`), which on
 * web renders a real `<button>` that takes focus and the keyboard, rather
 * than the styled `Button` from `tamagui`, whose own sizes, `level2` theme and
 * icon theming would fight these variants. That skin's `web:pointer` cursor
 * is the one part kept.
 *
 * Tailwind mirrored: `rounded-lg` (8.8), `border` (1, transparent),
 * `text-sm font-medium` (14/500), `h-8 px-2.5 gap-1.5` (32/10/6) for
 * `default`, `h-6 px-2 gap-1 text-xs rounded-md` for `xs`, `h-7 px-2.5 gap-1
 * text-[0.8rem] rounded-md` for `sm`, `h-9` for `lg`, `size-8/6/7/9` for the
 * icon sizes, `[&_svg]:size-4` (`size-3` xs, `size-3.5` sm), and
 * `disabled:opacity-50`.
 *
 * Native differences: `hover:` becomes a `press:` clause; `lg` is at least 48 high
 * and every other size reaches 48 through `hitSlop`, for touch; `link`
 * dims on press instead of underlining on hover.
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
  borderWidth: 1,
  borderColor: "transparent",
  rounded: radius.lg,
  cursor: "web:pointer",

  variants: {
    variant: {
      default: { bg: "primary press:primary-pressed" },
      outline: {
        bg: "button-outline press:button-outline-pressed",
        borderColor: "button-outline-border",
      },
      secondary: { bg: "secondary press:secondary-hover" },
      ghost: { bg: "transparent press:button-ghost-pressed" },
      destructive: {
        bg: "button-destructive press:button-destructive-pressed",
      },
      link: { bg: "transparent", opacity: "1 press:0.7" },
    },
    size: {
      default: { h: 32, px: 10, gap: 6 },
      xs: { h: 24, px: 8, gap: 4, rounded: radius.md },
      sm: { h: 28, px: 10, gap: 4, rounded: radius.md },
      lg: { minH: 48, px: 10, gap: 6 },
      icon: { w: 32, h: 32 },
      "icon-xs": { w: 24, h: 24, rounded: radius.md },
      "icon-sm": { w: 28, h: 28, rounded: radius.md },
      "icon-lg": { w: 36, h: 36 },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,

  defaultVariants: { variant: "default", size: "default" },
})

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
  fontWeight: fontWeight.medium,
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,

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
      sm: { fontSize: 12.8 },
      lg: {},
      icon: {},
      "icon-xs": {},
      "icon-sm": {},
      "icon-lg": {},
    },
  } as const,
})

const iconSizes = {
  default: 16,
  xs: 12,
  sm: 14,
  lg: 16,
  icon: 16,
  "icon-xs": 12,
  "icon-sm": 16,
  "icon-lg": 16,
} as const satisfies Record<ButtonSize, number>

/** Extends each size's hit area to 48, the Android touch target. */
const hitSlops = {
  default: 8,
  xs: 12,
  sm: 10,
  lg: 0,
  icon: 8,
  "icon-xs": 12,
  "icon-sm": 10,
  "icon-lg": 6,
} as const satisfies Record<ButtonSize, number>

type FrameProps = Omit<
  GetProps<typeof ButtonFrame>,
  "children" | "variant" | "size" | "disabled" | "onPress"
>

interface ButtonBaseProps extends FrameProps {
  readonly variant?: ButtonVariant
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
  ...frameProps
}: ButtonProps) {
  const theme = useTheme()
  const inactive = disabled || pending
  const color = labelColor ?? textColors[variant]
  const iconSize = iconSizes[size]
  const content = label ?? children
  // On web: a `<button>`, `disabled` and out of the tab order while inactive,
  // and an inert `<span>` (no role, no onPress) when nested in another button.
  const { props: buttonProps } = useButton<
    ButtonBehaviorProps & Pick<GetProps<typeof ButtonFrame>, "role" | "onPress">
  >({
    role: "button",
    onPress: inactive ? undefined : onPress,
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
      variant={variant}
      size={size}
      hitSlop={hitSlops[size]}
      aria-label={ariaLabel ?? label}
      aria-busy={pending}
    />
  )
}
