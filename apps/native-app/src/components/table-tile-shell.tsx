import Table2 from "lucide-react-native/icons/table-2"
import type { ReactNode } from "react"
import { type GetProps, Text, View, XStack } from "tamagui"
import { fontSize, fontWeight } from "../theme/tokens.ts"
import { Card } from "./ui/card.tsx"
import { Icon } from "./ui/icon.tsx"

/**
 * The visual shell of every table tile (the overview grid and the bill's
 * table picker), web's `TableTileShell` in
 * `apps/web-app/src/features/shared/table-tile.tsx`: occupancy is the whole
 * surface, so a free table stays bare and an occupied one is tinted, in the
 * info tone for one that needs a look (`attention`). Takes a plain
 * name/subtitle so no table row is needed.
 *
 * Tailwind mirrored: a `Card` with `h-full gap-3 p-4`; occupied `bg-primary/10
 * ring-primary/30`, attention `bg-info/10 ring-info/40`, free
 * `bg-transparent`; selected `ring-2 ring-primary`; the name `truncate
 * text-base font-semibold`, the subtitle `text-sm text-muted-foreground`,
 * the icon a muted `size-5` `Table2` at the top right.
 *
 * A tile on the page is a block (the `tile*` keys: white on a light page);
 * one in a dialog (`inDialog`) sits in a white sheet, so it takes the neutral
 * fill and the plain tints instead.
 */
export function TableTileShell({
  name,
  subtitle,
  occupied,
  attention = false,
  selected = false,
  inDialog = false,
  icon = <Icon icon={Table2} size={20} color="muted-foreground" />,
  children,
  ...cardProps
}: Omit<GetProps<typeof Card>, "children"> & {
  /** Already translated or user-entered. */
  readonly name: string
  readonly subtitle?: string
  readonly occupied: boolean
  readonly attention?: boolean
  readonly selected?: boolean
  /** In a dialog's sheet rather than on the page. */
  readonly inDialog?: boolean
  /** Replaces the table icon; `null` hides it. */
  readonly icon?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <Card
      flex={1}
      minH={112}
      p={16}
      gap={12}
      // No frame (fazole.fit): a chosen tile is the soft accent, an occupied
      // one its tint, a free one the neutral fill.
      bg={
        selected
          ? inDialog
            ? "accent"
            : "tile-accent"
          : occupied
            ? attention
              ? inDialog
                ? "info-10"
                : "tile-info-10"
              : inDialog
                ? "primary-10"
                : "tile-primary-10"
            : inDialog
              ? "neutral-soft"
              : "tile"
      }
      {...cardProps}
    >
      <XStack items="flex-start" justify="space-between" gap={8}>
        <View shrink={1} minW={0}>
          <Text
            fontSize={fontSize.base}
            lineHeight={fontSize.base}
            fontWeight={fontWeight.semibold}
            numberOfLines={1}
          >
            {name}
          </Text>
          {subtitle === undefined ? null : (
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >
              {subtitle}
            </Text>
          )}
        </View>
        {icon}
      </XStack>
      {children}
    </Card>
  )
}
