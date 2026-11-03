import type { LucideIcon } from "lucide-react-native"
import { Children, type ReactNode } from "react"
import { createStyledContext, styled, Text, View } from "tamagui"
import type { ThemeColor } from "../../theme/themes.ts"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import { Icon } from "./icon.tsx"

/**
 * Web `apps/web-app/src/components/reui/alert.tsx`: `Alert` with the same
 * variants, `AlertTitle`, `AlertDescription` and `AlertAction`, drawn as
 * fazole.fit's `Notice` (Linky's `packages/ui/src/feedback.tsx`): a
 * 12-round, borderless tinted fill, `px-3 py-3`, a 20 icon in the tone's
 * color beside a semibold 14 title and a 12 description.
 *
 * Tailwind mirrored otherwise: `gap-x-2.5` beside the icon, `gap-y-0.5`;
 * `default` `bg-card text-card-foreground`; `destructive`/`info`/`success`/
 * `warning` `bg-<v>/10` with the icon in `<v>`; `invert` `bg-invert
 * text-invert-foreground`, description `text-invert-foreground/70`. The
 * title is `line-clamp-1`, and the action on a phone (`max-sm:`) sits under
 * the text, `mt-2 gap-1.5`.
 *
 * Native differences: web's first `<svg>` child becomes the `icon` prop,
 * since there is no `has-[>svg]` selector; the icon is always top-aligned
 * beside the text.
 */

type AlertVariant =
  | "default"
  | "destructive"
  | "info"
  | "success"
  | "warning"
  | "invert"

const AlertContext = createStyledContext<{ variant: AlertVariant }>({
  variant: "default",
})

const AlertFrame = styled(View, {
  name: "Alert",
  context: AlertContext,
  role: "alert",
  flexDirection: "row",
  items: "flex-start",
  gap: 10,
  w: "100%",
  rounded: shape.control,
  px: 12,
  py: 12,

  variants: {
    variant: {
      default: { bg: "card" },
      destructive: { bg: "destructive-10" },
      info: { bg: "info-10" },
      success: { bg: "success-10" },
      warning: { bg: "warning-10" },
      invert: { bg: "invert" },
    },
  } as const,

  defaultVariants: { variant: "default" },
})

const iconColors = {
  default: "card-foreground",
  destructive: "destructive",
  info: "info",
  success: "success",
  warning: "warning",
  invert: "invert-foreground",
} as const satisfies Record<AlertVariant, ThemeColor>

export function Alert({
  variant = "default",
  icon,
  children,
}: {
  readonly variant?: AlertVariant
  readonly icon?: LucideIcon
  readonly children?: ReactNode
}) {
  return (
    <AlertFrame variant={variant} role="alert">
      {icon === undefined ? null : (
        <Icon icon={icon} size={20} color={iconColors[variant]} />
      )}
      <View flex={1} gap={2}>
        {children}
      </View>
    </AlertFrame>
  )
}

export const AlertTitle = styled(Text, {
  name: "AlertTitle",
  context: AlertContext,
  numberOfLines: 1,
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
  fontWeight: fontWeight.semibold,

  variants: {
    variant: {
      default: { color: "card-foreground" },
      destructive: { color: "color" },
      info: { color: "color" },
      success: { color: "color" },
      warning: { color: "color" },
      invert: { color: "invert-foreground" },
    },
  } as const,
})

const AlertDescriptionText = styled(Text, {
  name: "AlertDescription",
  context: AlertContext,
  fontSize: fontSize.xs,
  lineHeight: fontSize.xs,

  variants: {
    variant: {
      default: { color: "muted-foreground" },
      destructive: { color: "muted-foreground" },
      info: { color: "muted-foreground" },
      success: { color: "muted-foreground" },
      warning: { color: "muted-foreground" },
      invert: { color: "invert-foreground-70" },
    },
  } as const,
})

/** Each string child is one paragraph; other children render as they are. */
export function AlertDescription({
  children,
}: {
  readonly children?: ReactNode
}) {
  return (
    <View gap={4} items="flex-start">
      {Children.map(children, (child) =>
        typeof child === "string" ? (
          <AlertDescriptionText>{child}</AlertDescriptionText>
        ) : (
          child
        )
      )}
    </View>
  )
}

export const AlertAction = styled(View, {
  name: "AlertAction",
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 6,
  mt: 8,
})
