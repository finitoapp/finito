import type { Href } from "expo-router"
import type { ReactNode } from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"
import { isWeb, styled, View as TamaguiView, Text } from "tamagui"
import { usePathnameSelect } from "../core/current-pathname.ts"
import { isDetailOf, useMasterPane } from "../core/master-pane.ts"
import { useOpenDetail } from "../hooks/use-open-detail.ts"
import { useAppColors } from "../theme/app-colors.ts"
import type { ThemeColor } from "../theme/themes.ts"
import { control, fontSize, fontWeight, shape } from "../theme/tokens.ts"
import { LucideGlyph } from "./lucide-glyph"
import {
  PressFill,
  type PressFillColors,
  usePressFill,
} from "./ui/press-fill.tsx"

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
export const VerticalNavShell = styled(TamaguiView, {
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
  | {
      readonly kind: "link"
      readonly href: Href
      /** Runs as the row opens its screen, to start loading that screen. */
      readonly onOpen?: () => void
    }
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
      return () => {
        item.onOpen?.()
        openDetail(item.href)
      }
    case "href":
      return () => void Linking.openURL(item.href)
    case "button":
      return item.onPress
    case "static":
      return undefined
  }
}

/** A row's fill under the finger, drawn by a `PressFill` on native. */
const rowFill = {
  rest: "transparent",
  pressed: "neutral-soft",
} as const satisfies PressFillColors

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: control.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: shape.control,
  },
  label: { flex: 1, minWidth: 0 },
  action: { flexShrink: 0, paddingLeft: 8 },
})

/**
 * A pressable row on web: the pointer cursor, and the hover fill's fade as a
 * CSS transition, which react-native-web passes on (React Native's types do
 * not name it).
 */
const webPressableRow = {
  cursor: "pointer" as const,
  transitionProperty: "background-color",
  transitionDuration: "150ms",
  transitionTimingFunction: "ease-out",
}

/**
 * One row of a `VerticalNav`, also drawn alone by a few screens. Its frame
 * is React Native's own `Pressable` and `View`, not Tamagui's, and its
 * colors come from `useAppColors`: a settings screen drew ~18 rows, each
 * frame resolving its styles and each icon subscribing to the theme on
 * every visit (2026-11-17). The label stays Tamagui `Text`, the kit's type.
 */
export function VerticalNavRow({
  item,
}: {
  readonly item: VerticalNavItem
  /** Kept for the callers that number their rows; rows have no rule to drop. */
  readonly first?: boolean
}) {
  const openDetail = useOpenDetail()
  const masterPane = useMasterPane()
  const colors = useAppColors()
  // In a master pane the row whose detail is open beside it reads as
  // selected. Only that fact is read from the route, so a navigation renders
  // the rows whose selection it changes, not the whole list under it.
  const detailOpen = usePathnameSelect(
    (pathname) =>
      masterPane !== null &&
      item.kind === "link" &&
      isDetailOf(pathname, item.href)
  )
  const disabled = item.disabled === true
  const onPress = disabled ? undefined : press(item, openDetail)
  const interactive = item.kind !== "static"
  const active = item.active ?? detailOpen
  // The active row is tinted instead, and a static or disabled one is inert.
  const pressable = interactive && !disabled && !active
  const pressFill = usePressFill({ disabled: !pressable })
  const frame = [
    rowStyles.row,
    {
      borderLeftWidth: item.stripeColor === undefined ? 0 : 3,
      borderLeftColor:
        item.stripeColor === undefined
          ? "transparent"
          : colors[item.stripeColor],
      backgroundColor: active ? colors.accent : "transparent",
      opacity: disabled ? 0.5 : 1,
    },
  ]
  const content = (
    <>
      {pressable ? (
        <PressFill
          progress={pressFill.progress}
          colors={rowFill}
          rounded={shape.control}
        />
      ) : null}
      {item.icon}
      <View style={rowStyles.label}>
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
        <View style={rowStyles.action}>
          {item.action ?? (
            <LucideGlyph
              name="chevron-right"
              size={20}
              color={colors.color}
              allowFontScaling={false}
            />
          )}
        </View>
      )}
    </>
  )
  const accessibility = {
    accessible: interactive ? true : undefined,
    role:
      item.kind === "link" || item.kind === "href"
        ? ("link" as const)
        : item.kind === "button"
          ? ("button" as const)
          : undefined,
    "aria-label":
      item.accessibilityLabel ??
      (typeof item.label === "string" ? item.label : undefined),
    "aria-disabled": disabled || undefined,
  }

  if (onPress === undefined)
    return (
      <View style={frame} {...accessibility}>
        {content}
      </View>
    )
  return (
    <Pressable
      {...accessibility}
      onPress={onPress}
      {...(pressable
        ? { onPressIn: pressFill.onPressIn, onPressOut: pressFill.onPressOut }
        : {})}
      // On web the fill is the frame's own, under a pointer or a press; a
      // style function there only, as it renders the row on every press.
      style={
        isWeb
          ? (state) => [
              ...frame,
              webPressableRow,
              pressable &&
              (state.pressed || ("hovered" in state && state.hovered === true))
                ? { backgroundColor: colors[rowFill.pressed] }
                : null,
            ]
          : frame
      }
    >
      {content}
    </Pressable>
  )
}
