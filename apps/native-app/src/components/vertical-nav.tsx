import { type Href, router } from "expo-router"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import type { ReactNode } from "react"
import { Linking } from "react-native"
import { styled, Text, View } from "tamagui"
import type { ThemeColor } from "../theme/themes.ts"
import { fontSize, fontWeight, radius } from "../theme/tokens.ts"
import { Icon } from "./ui/icon.tsx"

/**
 * Web `apps/web-app/src/components/vertical-nav.tsx`: a card of rows, each
 * an icon, a label and a trailing action or chevron, divided by hairlines.
 *
 * Tailwind mirrored: the shell `bg-card rounded-md overflow-hidden`, the
 * title `p-4 font-bold text-xs text-muted-foreground`, the rows `divide-y`,
 * `gap-3 px-3 py-2 text-sm font-medium` with `p-1`/`p-0.5` inside, the
 * chevron `size-4`, the action `shrink-0 pl-2`.
 *
 * The row's padding is the sum of web's: 18 px across (`px-3 p-1 p-0.5`),
 * 14 px down (`py-2 p-1 p-0.5`), so a one-line row is 48 high, Android's
 * minimum touch target, as on web.
 *
 * Native differences: the shell has no `shadow` (Tamagui 3 `styled()` takes
 * no elevation); a pressed row takes
 * `bg-accent` (web hovers `bg-accent/50`); a `link` row pushes an
 * expo-router `href`, an `href` row opens the URL outside the app.
 */

/** The shell a `VerticalNav` draws, shared with `ListSkeleton` so the two cannot drift apart. */
export const VerticalNavShell = styled(View, {
  name: "VerticalNavShell",
  bg: "card",
  rounded: radius.md,
  overflow: "hidden",
})

/** The title row a `VerticalNav` draws, shared with `ListSkeleton` for the same reason. */
export const VerticalNavTitle = styled(Text, {
  name: "VerticalNavTitle",
  p: 16,
  fontSize: fontSize.xs,
  lineHeight: fontSize.xs,
  fontWeight: fontWeight.bold,
  color: "muted-foreground",
})

type NavItemTarget =
  | { readonly kind: "link"; readonly href: Href }
  | { readonly kind: "href"; readonly href: string }
  | { readonly kind: "button"; readonly onPress?: () => void }
  /** A read-only row: no press, nothing to activate. */
  | { readonly kind: "static" }

export type VerticalNavItem = NavItemTarget & {
  /** Stable identity for list reconciliation; falls back to the index. */
  readonly id?: string
  /** Already translated; a string is drawn as the row's text. */
  readonly label: ReactNode
  readonly action?: ReactNode
  readonly icon?: ReactNode
  readonly disableAction?: boolean
  /** Keep the row visible and announced while preventing its action. */
  readonly disabled?: boolean
  /** Tint a selected static row, as in the active account list item. */
  readonly active?: boolean
  /** TalkBack name when `label` is not a string. */
  readonly accessibilityLabel?: string
  /**
   * A 3 px stripe on the row's leading edge, as web's activity rows mark an
   * issue with `shadow-[inset_3px_0_0_…]` (web passes it as `className`).
   */
  readonly stripeColor?: ThemeColor
}

export function VerticalNav({
  items,
  empty,
  title,
  children,
  shrink = false,
  testID,
}: {
  readonly items: ReadonlyArray<VerticalNavItem>
  readonly empty?: ReactNode
  readonly title?: string
  /** Custom virtualized body, still inside the shared card shell. */
  readonly children?: ReactNode
  /**
   * Size the card to an embedded list's rows but shrink it to its parent,
   * so a long list scrolls inside the card and a short one ends with it.
   */
  readonly shrink?: boolean
  /** Web's `data-testid` on the list, for e2e flows. */
  readonly testID?: string
}) {
  return (
    <VerticalNavShell shrink={shrink ? 1 : undefined} testID={testID}>
      {title === undefined || title === "" ? null : (
        <VerticalNavTitle role="heading">{title}</VerticalNavTitle>
      )}
      {children !== undefined ? (
        children
      ) : items.length === 0 && empty !== undefined ? (
        <VerticalNavRow
          item={{ kind: "static", disableAction: true, label: empty }}
          first
        />
      ) : (
        items.map((item, index) => (
          <VerticalNavRow
            key={item.id ?? index}
            item={item}
            first={index === 0}
          />
        ))
      )}
    </VerticalNavShell>
  )
}

const press = (item: VerticalNavItem): (() => void) | undefined => {
  switch (item.kind) {
    case "link":
      return () => router.push(item.href)
    case "href":
      return () => void Linking.openURL(item.href)
    case "button":
      return item.onPress
    case "static":
      return undefined
  }
}

export function VerticalNavRow({
  item,
  first,
}: {
  readonly item: VerticalNavItem
  readonly first: boolean
}) {
  const disabled = item.disabled === true
  const onPress = disabled ? undefined : press(item)
  const interactive = item.kind !== "static"
  return (
    <View
      flexDirection="row"
      items="center"
      gap={12}
      px={18}
      py={14}
      borderTopWidth={first ? 0 : 1}
      borderColor="border-color"
      borderLeftWidth={item.stripeColor === undefined ? 0 : 3}
      borderLeftColor={item.stripeColor ?? "transparent"}
      bg={
        item.active
          ? "primary-5"
          : interactive && !disabled
            ? "transparent press:accent"
            : "transparent"
      }
      onPress={onPress}
      cursor={onPress === undefined ? undefined : "web:pointer"}
      opacity={disabled ? 0.5 : undefined}
      accessible={interactive ? true : undefined}
      role={
        item.kind === "link" || item.kind === "href"
          ? "link"
          : item.kind === "button"
            ? "button"
            : undefined
      }
      aria-label={
        item.accessibilityLabel ??
        (typeof item.label === "string" ? item.label : undefined)
      }
      aria-disabled={disabled || undefined}
    >
      {item.icon}
      <View flex={1} minW={0}>
        {typeof item.label === "string" ? (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
          >
            {item.label}
          </Text>
        ) : (
          item.label
        )}
      </View>
      {item.disableAction === true ? null : (
        <View shrink={0} pl={8}>
          {item.action ?? <Icon icon={ChevronRight} />}
        </View>
      )}
    </View>
  )
}
