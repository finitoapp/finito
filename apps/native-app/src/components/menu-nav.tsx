import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { router } from "expo-router"
import type { LucideIcon } from "lucide-react-native"
import Clock3 from "lucide-react-native/icons/clock-3"
import House from "lucide-react-native/icons/house"
import Package from "lucide-react-native/icons/package"
import Settings from "lucide-react-native/icons/settings"
import { useEffect, useRef, useState } from "react"
import { Animated, Easing } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text, useTheme, View, XStack, YStack } from "tamagui"
import {
  type MenuTab,
  menuTabOrder,
  menuTabTargets,
} from "../core/menu-routes.ts"
import { useTranslation } from "../hooks/use-translation.ts"
import { isReduceMotionEnabled } from "../platform/reduce-motion.ts"
import { fontSize, fontWeight, maxWidth, radius } from "../theme/tokens.ts"
import { Icon } from "./ui/icon.tsx"

/** The phone bar's height above the safe area, web's `h-12`, its icons centred; the active one rises over the marker. */
export const menuBarHeight = 48

/** The large monitor's sidebar, web's `w-56`. */
export const menuSidebarWidth = 224

/** Web's `lg`, from which the sidebar replaces the bottom bar. */
export const menuSidebarMinWidth = 1024

const menuTabFaces = {
  activity: { icon: Clock3, labelKey: "nav.activity" },
  catalog: { icon: Package, labelKey: "nav.catalog" },
  settings: { icon: Settings, labelKey: "nav.settings" },
} as const satisfies Record<
  MenuTab,
  { readonly icon: LucideIcon; readonly labelKey: TranslationKey }
>

/**
 * Web `apps/web-app/src/components/menu-nav.tsx`: the menu section's
 * navigation (navigation/0001), a bottom bar on a phone, drawn only on a
 * tab's root screen, and a left sidebar on a large window, drawn on every
 * screen of the section. The root layout mounts it beside its stack, which
 * leaves it the room it takes. Switching tabs replaces the screen, so Back
 * and Home leave the section instead of rewinding through tabs.
 *
 * Tailwind mirrored: the bar `border-t bg-background h-12 max-w-xl` with
 * `pb-[env(safe-area-inset-bottom)]`, its tabs a `size-6` icon alone, named
 * by its label for TalkBack; the sidebar `w-56 border-r p-3 gap-1`, its rows
 * `gap-3 px-3 py-2.5 text-sm font-medium rounded-lg`, the active one
 * `bg-muted`. The active tab is `text-primary`, the rest
 * `text-muted-foreground`.
 *
 * Motion, as web's (`sliding-pill.tsx`'s spring, here its 0.35 s ease-out
 * as `sliding-pill.tsx` ports it): the active tab's marker, a half-circle bubble
 * under the bar's icon (flat side down) or the row's background in the sidebar, slides from
 * the tab that had it; the bar's centred active icon grows to 1.1 and
 * rises 4 px over the marker while its color fades to primary (two icons cross-fading, so it runs on the native driver);
 * a press dips the icon to 0.9. The layout keeps this nav mounted across
 * the tab routes, which is what lets the marker travel. Both open with
 * Home, the way out of the section, ahead of the tabs. Reduced motion
 * switches at once and drops the dip.
 *
 * Native differences: the sidebar's label switches color at once, where
 * web's fades with the icon.
 */
const slide = { duration: 350, easing: Easing.out(Easing.cubic) }

/** Drives `value` to `toValue` on the slide curve, or at once under reduced motion. */
const animateTo = (
  value: Animated.Value,
  toValue: number,
  duration = slide.duration
) => {
  if (isReduceMotionEnabled()) {
    value.setValue(toValue)
    return
  }
  Animated.timing(value, {
    toValue,
    duration,
    easing: slide.easing,
    useNativeDriver: true,
  }).start()
}

/**
 * The marker's offset along the nav: `step` is one tab's extent (0 until
 * measured), `index` the active tab. The first measure places it at once.
 */
function useMarkerOffset(index: number, step: number, inset: number) {
  const [offset] = useState(() => new Animated.Value(0))
  const placed = useRef(false)
  useEffect(() => {
    if (step === 0) return
    const target = index * step + inset
    if (placed.current) {
      animateTo(offset, target)
    } else {
      offset.setValue(target)
      placed.current = true
    }
  }, [index, step, inset, offset])
  return offset
}

/** The bar's marker, web's `h-1.5 w-3 rounded-t-full bottom-0.5`. */
const markerWidth = 12
const markerHeight = 6
const sidebarGap = 4

export function MenuNav({
  active,
  variant,
}: {
  readonly active: MenuTab
  readonly variant: "bar" | "sidebar"
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  // Home comes first, so the active tab sits one slot further along.
  const index = menuTabOrder.indexOf(active) + 1
  const [tabWidth, setTabWidth] = useState(0)
  const [rowHeight, setRowHeight] = useState(0)
  const barOffset = useMarkerOffset(
    index,
    tabWidth,
    (tabWidth - markerWidth) / 2
  )
  const sidebarOffset = useMarkerOffset(
    index,
    rowHeight === 0 ? 0 : rowHeight + sidebarGap,
    0
  )

  if (variant === "sidebar") {
    return (
      <YStack
        role="navigation"
        aria-label={t("nav.menu")}
        w={menuSidebarWidth}
        shrink={0}
        borderRightWidth={1}
        borderColor="border-color"
        bg="background"
        p={12}
        pt={12 + insets.top}
        gap={sidebarGap}
      >
        {rowHeight === 0 ? null : (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 12 + insets.top,
              left: 12,
              right: 12,
              height: rowHeight,
              borderRadius: radius.lg,
              backgroundColor: theme.muted?.val,
              transform: [{ translateY: sidebarOffset }],
            }}
          />
        )}
        <MenuHomeEntry compact={false} onLayoutHeight={setRowHeight} />
        {menuTabOrder.map((tab) => (
          <MenuNavLink
            key={tab}
            tab={tab}
            active={tab === active}
            compact={false}
          />
        ))}
      </YStack>
    )
  }

  return (
    <View
      role="navigation"
      aria-label={t("nav.menu")}
      borderTopWidth={1}
      borderColor="border-color"
      bg="background"
      pb={insets.bottom}
    >
      <XStack
        h={menuBarHeight}
        w="100%"
        maxW={maxWidth.xl}
        self="center"
        onLayout={(event) =>
          setTabWidth(
            event.nativeEvent.layout.width / (menuTabOrder.length + 1)
          )
        }
      >
        {tabWidth === 0 ? null : (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 2,
              left: 0,
              width: markerWidth,
              height: markerHeight,
              borderTopLeftRadius: markerHeight,
              borderTopRightRadius: markerHeight,
              backgroundColor: theme.primary?.val,
              transform: [{ translateX: barOffset }],
            }}
          />
        )}
        <MenuHomeEntry compact />
        {menuTabOrder.map((tab) => (
          <MenuNavLink key={tab} tab={tab} active={tab === active} compact />
        ))}
      </XStack>
    </View>
  )
}

/**
 * Home, ahead of the tabs: it leaves the section the way it was entered, as
 * web's `MenuHomeEntry` (navigation/0001). The section opens from home and
 * its tab switches replace the screen, so going back returns there; a
 * screen opened cold goes home instead. Never the active entry.
 */
function MenuHomeEntry({
  compact,
  onLayoutHeight,
}: {
  readonly compact: boolean
  readonly onLayoutHeight?: (height: number) => void
}) {
  const { t } = useTranslation()
  return (
    <MenuNavEntry
      icon={House}
      label={t("nav.home")}
      role="button"
      active={false}
      compact={compact}
      onLayoutHeight={onLayoutHeight}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    />
  )
}

function MenuNavLink({
  tab,
  active,
  compact,
}: {
  readonly tab: MenuTab
  readonly active: boolean
  readonly compact: boolean
}) {
  const { t } = useTranslation()
  const { icon, labelKey } = menuTabFaces[tab]
  return (
    <MenuNavEntry
      icon={icon}
      label={t(labelKey)}
      role="link"
      active={active}
      compact={compact}
      onPress={() => {
        if (!active) router.replace(menuTabTargets[tab].href)
      }}
    />
  )
}

/** One entry of the bar or the sidebar: a tab's link or Home's button. */
function MenuNavEntry({
  icon,
  label,
  role,
  active,
  compact,
  onPress,
  onLayoutHeight,
}: {
  readonly icon: LucideIcon
  /** Already translated. */
  readonly label: string
  readonly role: "link" | "button"
  readonly active: boolean
  readonly compact: boolean
  readonly onPress: () => void
  /** Reports the row's height, for the sidebar's sliding background. */
  readonly onLayoutHeight?: (height: number) => void
}) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0))
  const [press] = useState(() => new Animated.Value(1))
  useEffect(() => {
    animateTo(progress, active ? 1 : 0)
  }, [active, progress])
  const dip = (toValue: number) => {
    if (!isReduceMotionEnabled()) animateTo(press, toValue, 150)
  }
  const iconSize = compact ? 24 : 20

  return (
    <View
      flex={compact ? 1 : undefined}
      flexDirection="row"
      items="center"
      justify={compact ? "center" : "flex-start"}
      gap={12}
      px={12}
      py={compact ? 0 : 10}
      rounded={radius.lg}
      bg="transparent press:accent"
      cursor="web:pointer"
      onLayout={
        onLayoutHeight === undefined
          ? undefined
          : (event) => onLayoutHeight(event.nativeEvent.layout.height)
      }
      onPressIn={() => dip(0.9)}
      onPressOut={() => dip(1)}
      onPress={onPress}
      accessible
      role={role}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <Animated.View
        style={{
          width: iconSize,
          height: iconSize,
          transform: [
            {
              translateY: compact
                ? progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  })
                : 0,
            },
            {
              scale: compact
                ? Animated.multiply(
                    press,
                    progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.1],
                    })
                  )
                : press,
            },
          ],
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          }}
        >
          <Icon icon={icon} size={iconSize} color="muted-foreground" />
        </Animated.View>
        <Animated.View style={{ position: "absolute", opacity: progress }}>
          <Icon
            icon={icon}
            size={iconSize}
            color="primary"
            strokeWidth={2.75}
          />
        </Animated.View>
      </Animated.View>
      {compact ? null : (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          color={active ? "primary" : "muted-foreground"}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </View>
  )
}
