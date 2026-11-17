import { type Href, usePathname } from "expo-router"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import type { ReactNode } from "react"
import { Linking } from "react-native"
import { styled, Text, View } from "tamagui"
import { isDetailOf, useMasterPane } from "../core/master-pane.ts"
import { useOpenDetail } from "../hooks/use-open-detail.ts"
import type { ThemeColor } from "../theme/themes.ts"
import { control, fontSize, fontWeight, shape } from "../theme/tokens.ts"
import { Icon } from "./ui/icon.tsx"

/**
 * Web `apps/web-app/src/components/vertical-nav.tsx`: a card of rows, each
 * an icon, a label and a trailing action or chevron, drawn as fazole.fit's
 * list (Linky's `packages/ui/src/lists.tsx` `ListRow` in a `Card`): a
 * 16-round `bg-card` shell `py-2`, an eyebrow title, and 12-round rows
 * `px-3 py-2` at least 56 high that light up with the neutral fill when
 * pressed and the accent tint when active, with no rules between them.
 *
 * Tailwind mirrored otherwise: the title `p-4 font-bold text-xs
 * text-muted-foreground`, the rows `gap-3 text-sm font-medium`, the chevron
 * `size-4`, the action `shrink-0 pl-2`.
 *
 * Native differences: the shell has no `shadow` (Tamagui 3 `styled()` takes
 * no elevation); a `link` row pushes an expo-router `href` (`useOpenDetail`:
 * in a wide window's master pane it replaces the detail beside it, and the
 * row of the detail shown there is tinted as active, navigation/0002), an
 * `href` row opens the URL outside the app.
 */

/** The shell a `VerticalNav` draws, shared with `ListSkeleton` so the two cannot drift apart. */
export const VerticalNavShell = styled(View, {
  name: "VerticalNavShell",
  bg: "card",
  rounded: shape.card,
  py: 8,
  px: 8,
  overflow: "hidden",
})

/** The title row a `VerticalNav` draws, shared with `ListSkeleton` for the same reason. */
export const VerticalNavTitle = styled(Text, {
  name: "VerticalNavTitle",
  px: 12,
  pt: 8,
  pb: 4,
  fontSize: fontSize.xs,
  lineHeight: fontSize.xs,
  fontWeight: fontWeight.bold,
  letterSpacing: 1,
  textTransform: "uppercase",
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

const press = (
  item: VerticalNavItem,
  openDetail: (href: Href) => void
): (() => void) | undefined => {
  switch (item.kind) {
    case "link":
      return () => openDetail(item.href)
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
}: {
  readonly item: VerticalNavItem
  /** Kept for the callers that number their rows; rows have no rule to drop. */
  readonly first?: boolean
}) {
  const openDetail = useOpenDetail()
  const masterPane = useMasterPane()
  const pathname = usePathname()
  const disabled = item.disabled === true
  const onPress = disabled ? undefined : press(item, openDetail)
  const interactive = item.kind !== "static"
  // In a master pane the row whose detail is open beside it reads as selected.
  const active =
    item.active ??
    (masterPane !== null &&
      item.kind === "link" &&
      isDetailOf(pathname, item.href))
  return (
    <View
      flexDirection="row"
      items="center"
      gap={12}
      minH={control.lg}
      px={12}
      py={8}
      rounded={shape.control}
      borderLeftWidth={item.stripeColor === undefined ? 0 : 3}
      borderLeftColor={item.stripeColor ?? "transparent"}
      transition="fast"
      bg={
        active
          ? "accent"
          : interactive && !disabled
            ? "transparent hover:neutral-soft press:neutral-soft"
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
