import type { LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { Text, YStack } from "tamagui"
import { fontSize, fontWeight } from "../theme/tokens.ts"
import { Icon } from "./ui/icon.tsx"

export interface EmptyStateProps {
  readonly icon?: LucideIcon
  /** Already translated. */
  readonly title?: string
  /** Already translated. */
  readonly description: string
  /** A button that fills the gap, e.g. "Add a terminal". */
  readonly action?: ReactNode
}

/**
 * A screen or card whose whole content is an empty list: a 40 muted icon, an
 * optional `sm` semibold title over the `sm` muted description, and an optional
 * action under it, centred, in `NotFoundCard`'s look (`gap-4 py-10`). It
 * draws no card itself, so it sits inside a `CardContent` or straight on a
 * screen. A list with rows around the gap uses `VerticalNav`'s `empty` row
 * instead. Native only: web has no counterpart file.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <YStack items="center" gap={16} py={40}>
      {icon === undefined ? null : (
        <Icon icon={icon} size={40} color="muted-foreground" />
      )}
      <YStack items="center" gap={4}>
        {title === undefined ? null : (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
            text="center"
          >
            {title}
          </Text>
        )}
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
          text="center"
        >
          {description}
        </Text>
      </YStack>
      {action}
    </YStack>
  )
}
