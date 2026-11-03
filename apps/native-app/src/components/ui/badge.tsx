import type { LucideIcon } from "lucide-react-native"
import { createStyledContext, type GetProps, styled, Text, View } from "tamagui"
import type { ThemeColor } from "../../theme/themes.ts"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import { Icon } from "./icon.tsx"

/**
 * Web `apps/web-app/src/components/ui/badge.tsx`: the same variants.
 *
 * Tailwind mirrored: `h-5 gap-1 rounded-4xl px-2 text-xs font-medium
 * [&>svg]:size-3` (20/4/pill/8/12/500/12); `default` `bg-primary`,
 * `secondary` `bg-secondary`, `destructive` `bg-destructive/10
 * dark:bg-destructive/20 text-destructive`, `ghost` and `link` transparent.
 * As fazole.fit's pills, `outline` is the neutral fill rather than a
 * border. Web's `[a]:hover` tints apply only to a badge that is a link;
 * native badges are never pressable.
 */

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"

const BadgeContext = createStyledContext<{ variant: BadgeVariant }>({
  variant: "default",
})

const BadgeFrame = styled(View, {
  name: "Badge",
  context: BadgeContext,
  flexDirection: "row",
  items: "center",
  justify: "center",
  self: "flex-start",
  shrink: 0,
  h: 20,
  gap: 4,
  px: 8,
  rounded: shape.pill,
  overflow: "hidden",

  variants: {
    variant: {
      default: { bg: "primary" },
      secondary: { bg: "secondary" },
      destructive: { bg: "destructive-tint" },
      outline: { bg: "neutral-soft" },
      ghost: {},
      link: {},
    },
  } as const,

  defaultVariants: { variant: "default" },
})

const textColors = {
  default: "primary-foreground",
  secondary: "secondary-foreground",
  destructive: "destructive",
  outline: "color",
  ghost: "color",
  link: "primary",
} as const satisfies Record<BadgeVariant, ThemeColor>

const BadgeText = styled(Text, {
  name: "BadgeText",
  context: BadgeContext,
  fontSize: fontSize.xs,
  lineHeight: fontSize.xs,
  fontWeight: fontWeight.medium,

  variants: {
    variant: {
      default: { color: textColors.default },
      secondary: { color: textColors.secondary },
      destructive: { color: textColors.destructive },
      outline: { color: textColors.outline },
      ghost: { color: textColors.ghost },
      link: { color: textColors.link },
    },
  } as const,
})

export interface BadgeProps
  extends Omit<GetProps<typeof BadgeFrame>, "children" | "variant"> {
  readonly variant?: BadgeVariant
  /** Already translated. */
  readonly label: string
  readonly icon?: LucideIcon
  /**
   * Recolors the label and icon, for the web call sites that tint a badge
   * with a class (`bg-warning/10 text-warning`); pass the tint as `bg`.
   */
  readonly labelColor?: ThemeColor
}

export function Badge({
  variant = "default",
  label,
  icon,
  labelColor,
  ...frameProps
}: BadgeProps) {
  const color = labelColor ?? textColors[variant]
  return (
    <BadgeFrame variant={variant} {...frameProps}>
      {icon === undefined ? null : <Icon icon={icon} size={12} color={color} />}
      <BadgeText
        numberOfLines={1}
        {...(labelColor === undefined ? {} : { color: labelColor })}
      >
        {label}
      </BadgeText>
    </BadgeFrame>
  )
}
