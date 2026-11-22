import type { LucideIcon } from "lucide-react-native"
import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
} from "react"
import { Text, View, XStack, YStack } from "tamagui"
import { YGroup } from "tamagui/unstyled"
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

/** True inside a `SettingsTileList`, whose group rounds the tiles instead. */
const GroupedContext = createContext(false)
export function SettingsTile({
  icon,
  title,
  description,
  trailing,
  children,
  testID,
}: SettingsTileProps) {
  const grouped = useContext(GroupedContext)
  return (
    <XStack
      items="center"
      gap={12}
      minH={56}
      px={12}
      py={8}
      rounded={grouped ? 0 : shape.control}
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

/**
 * `SettingsTile`s as one grouped block (Tamagui `YGroup`): 2 apart, only
 * the block's outer corners rounded. Each child sits in a clipping
 * `YGroup.Item` view, so a tile drawn by another component (a device row)
 * is grouped as well.
 */
export function SettingsTileList({
  children,
  testID,
}: {
  readonly children: ReactNode
  readonly testID?: string
}) {
  return (
    <GroupedContext value={true}>
      <YGroup gap={2} testID={testID}>
        {Children.toArray(children).map((child) => (
          // `toArray` keys every child, so a reordered list keeps its rows.
          <YGroup.Item key={isValidElement(child) ? child.key : null}>
            <View rounded={shape.control} overflow="hidden">
              {child}
            </View>
          </YGroup.Item>
        ))}
      </YGroup>
    </GroupedContext>
  )
}
