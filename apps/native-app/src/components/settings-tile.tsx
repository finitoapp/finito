import type { LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { Text, XStack, YStack } from "tamagui"
import { fontSize, fontWeight, shape } from "../theme/tokens.ts"
import { Icon } from "./ui/icon.tsx"

export interface SettingsTileProps {
  /** Drawn at 20, as a `VerticalNavRow`'s icon. */
  readonly icon?: LucideIcon
  /** A string is drawn `sm` semibold; a node (a status line, a URL) as is. */
  readonly title: ReactNode
  /** A string is drawn `xs` muted under the title; a node as is. */
  readonly description?: ReactNode
  /** The row's control: a switch, a badge, a labelled ghost `sm` remove. */
  readonly trailing?: ReactNode
  /** A body under the title and description, e.g. a row of actions or an editor. */
  readonly children?: ReactNode
  readonly testID?: string
}

/**
 * One editable row of a settings list, where a `VerticalNavRow` is for a
 * row that navigates or only reads: a device, a Fio token, a transport, a
 * tip preset. A `neutral-soft` fill 12 round (`shape.control`), at least 56
 * high, no border; the icon, the title over its description and any custom
 * body, and the trailing control. Lay several out in `SettingsTileList`.
 * Native only: web has no counterpart file.
 */
export function SettingsTile({
  icon,
  title,
  description,
  trailing,
  children,
  testID,
}: SettingsTileProps) {
  return (
    <XStack
      items="center"
      gap={12}
      minH={56}
      px={12}
      py={8}
      rounded={shape.control}
      bg="neutral-soft"
      testID={testID}
    >
      {icon === undefined ? null : <Icon icon={icon} />}
      <YStack flex={1} minW={0} gap={4}>
        {typeof title === "string" ? (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
          >
            {title}
          </Text>
        ) : (
          title
        )}
        {typeof description === "string" ? (
          <Text
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
          >
            {description}
          </Text>
        ) : (
          description
        )}
        {children}
      </YStack>
      {trailing === undefined ? null : (
        <XStack shrink={0} items="center" gap={8}>
          {trailing}
        </XStack>
      )}
    </XStack>
  )
}

/** `SettingsTile`s stacked 8 apart. */
export function SettingsTileList({
  children,
  testID,
}: {
  readonly children: ReactNode
  readonly testID?: string
}) {
  return (
    <YStack gap={8} testID={testID}>
      {children}
    </YStack>
  )
}
