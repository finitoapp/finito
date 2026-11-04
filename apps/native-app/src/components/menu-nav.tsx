import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { router, usePathname } from "expo-router"
import type { LucideIcon } from "lucide-react-native"
import Calculator from "lucide-react-native/icons/calculator"
import Clock3 from "lucide-react-native/icons/clock-3"
import Settings from "lucide-react-native/icons/settings"
import Store from "lucide-react-native/icons/store"
import { Suspense, useEffect, useRef, useState } from "react"
import { Animated, Easing, Image, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme, View, XStack, YStack } from "tamagui"
import appIcon from "../../assets/app-icon.png"
import {
  type MenuTab,
  menuPositionOf,
  menuTabOrder,
  menuTabTargets,
} from "../core/menu-routes.ts"
import {
  useNostrIdentity,
  useNostrProfile,
} from "../hooks/use-nostr-profile.ts"
import { useTranslation } from "../hooks/use-translation.ts"
import { control, maxWidth, shape } from "../theme/tokens.ts"
import { animateTo } from "./motion.ts"
import { Icon } from "./ui/icon.tsx"

/** The phone bar's height above the safe area: Linky's `TabBar`, 44 tabs in a `py-1` row. */

/** The wide window's rail, Linky's `NavigationRail` (`$hero`, 112). */
export const menuSidebarWidth = 112

/** Linky's `wide` breakpoint, from which the rail replaces the bottom bar. */
export const menuSidebarMinWidth = 961

const menuTabFaces = {
  terminal: { icon: Calculator, labelKey: "nav.home" },
  activity: { icon: Clock3, labelKey: "nav.activity" },
  catalog: { icon: Store, labelKey: "nav.pos" },
  settings: { icon: Settings, labelKey: "nav.settings" },
} as const satisfies Record<
  MenuTab,
  { readonly icon: LucideIcon; readonly labelKey: TranslationKey }
>

/**
 * Web `apps/web-app/src/components/menu-nav.tsx`: the menu section's
 * navigation (navigation/0001, native's navigation/0002), drawn as Linky's
 * (`packages/ui/src/navigation.tsx`): on a phone the `TabBar`, a row of
 * icon-only tabs on the raised surface, the active one on a solid accent
 * pill that slides from the tab that had it; on a wide window the
 * `NavigationRail`, a 112-wide column of icon-only entries under the
 * business's picture, the active one on the soft accent, with Settings
 * pinned to the bottom. Both open with the terminal, a calculator: on the
 * phone it is Home, the way out of the section; on the rail, which stays
 * on every screen, it is the terminal's own tab. The root layout mounts
 * it beside its stack, which leaves it the room it takes, and keeps it
 * mounted across the tab routes, which is what lets the pill travel.
 * Switching tabs replaces the screen, so Back and Home leave the section
 * instead of rewinding through tabs.
 *
 * Linky's labels are the entries' names (TalkBack, a browser tooltip),
 * never drawn. Motion is Linky's `base` transition (220 ms ease-out);
 * reduced motion switches at once.
 */
const slide = { duration: 220, easing: Easing.out(Easing.cubic) }

/** Drives `value` to `toValue` on the slide curve, or at once under reduced motion. */
const slideTo = (value: Animated.Value, toValue: number) =>
  animateTo(value, toValue, slide)

/**
 * The pill's offset along the bar: `step` is one tab's extent (0 until
 * measured), `index` the active tab. The first measure places it at once.
 */
function usePillOffset(index: number, step: number) {
  const [offset] = useState(() => new Animated.Value(0))
  const placed = useRef(false)
  useEffect(() => {
    if (step === 0) return
    const target = index * step
    if (placed.current) {
      slideTo(offset, target)
    } else {
      offset.setValue(target)
      placed.current = true
    }
  }, [index, step, offset])
  return offset
}

/** Linky's rail entries: `$row` (64) high, `gap-2` apart, `px-1 py-2`. */
const railEntryHeight = 64
const railGap = 4
/** Linky's rail header: Fazole's 44 logo tile, `mb-5` above the entries. */
const railLogoSize = 44

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
  const index = menuTabOrder.indexOf(active)
  const [tabWidth, setTabWidth] = useState(0)
  const barOffset = usePillOffset(index, tabWidth)

  if (variant === "sidebar") {
    const tabs = menuTabOrder.filter((tab) => tab !== "settings")
    return (
      <YStack
        role="navigation"
        aria-label={t("nav.menu")}
        w={menuSidebarWidth}
        shrink={0}
        bg="background"
        pt={16 + insets.top}
        px={8}
        pb={12}
        gap={railGap}
      >
        <View items="center" mb={20}>
          <Suspense fallback={<RailTile picture={null} />}>
            <RailProfileTile />
          </Suspense>
        </View>
        <YStack flex={1} gap={railGap}>
          {tabs.map((tab) => (
            <MenuNavLink
              key={tab}
              tab={tab}
              active={tab === active}
              variant="rail"
            />
          ))}
        </YStack>
        <MenuNavLink
          tab="settings"
          active={active === "settings"}
          variant="rail"
        />
      </YStack>
    )
  }

  return (
    <View
      role="navigation"
      aria-label={t("nav.menu")}
      bg="surface-raised"
      px={8}
      py={4}
      pb={4 + insets.bottom}
    >
      <XStack
        role="tablist"
        h={control.md}
        w="100%"
        maxW={maxWidth.xl}
        self="center"
        onLayout={(event) =>
          setTabWidth(event.nativeEvent.layout.width / menuTabOrder.length)
        }
      >
        {tabWidth === 0 ? null : (
          <Animated.View
            pointerEvents="none"
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: tabWidth,
              borderRadius: shape.control,
              backgroundColor: theme.primary?.val,
              transform: [{ translateX: barOffset }],
            }}
          />
        )}
        {menuTabOrder.map((tab) => (
          <MenuNavLink
            key={tab}
            tab={tab}
            active={tab === active}
            variant="bar"
          />
        ))}
      </XStack>
    </View>
  )
}

/**
 * The business at the top of the rail: its published picture, the app's
 * icon until it has one, opening the profile editor (name and picture),
 * which on a wide window lands beside Settings (navigation/0002). The
 * stack is first dismissed to Settings, so Back from the editor returns
 * there wherever the tile was pressed.
 */
function RailProfileTile() {
  const { t } = useTranslation()
  const identity = useNostrIdentity()
  const profile = useNostrProfile(identity.pubkey)
  const pathname = usePathname()
  const name = profile.data?.name ?? null
  return (
    <View
      rounded={shape.control}
      overflow="hidden"
      cursor="web:pointer"
      accessible
      role="link"
      aria-label={name ?? t("settings.profile.title")}
      {...(Platform.OS === "web"
        ? { title: name ?? t("settings.profile.title") }
        : {})}
      onPress={() => {
        if (pathname === "/settings/profile") return
        router.dismissTo("/settings")
        router.push("/settings/profile")
      }}
    >
      <RailTile picture={profile.data?.picture ?? null} />
    </View>
  )
}

function RailTile({ picture }: { readonly picture: string | null }) {
  return (
    <Image
      source={picture === null ? appIcon : { uri: picture }}
      style={{
        width: railLogoSize,
        height: railLogoSize,
        borderRadius: shape.control,
      }}
      accessibilityIgnoresInvertColors
      aria-hidden
    />
  )
}

function MenuNavLink({
  tab,
  active,
  variant,
}: {
  readonly tab: MenuTab
  readonly active: boolean
  readonly variant: "bar" | "rail"
}) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const { icon, labelKey } = menuTabFaces[tab]
  // The terminal's entry on the bar is Home: it leaves the section the way
  // it was entered, as web's `MenuHomeEntry` (navigation/0001). The section
  // opens from home and its tab switches replace the screen, so going back
  // returns there; a screen opened cold goes home instead. On the rail,
  // which the terminal's own screens share, it dismisses to home.
  const home = tab === "terminal"
  return (
    <MenuNavEntry
      icon={icon}
      label={t(labelKey)}
      role={home && variant === "bar" ? "button" : "tab"}
      active={active}
      variant={variant}
      onPress={() => {
        if (active) return
        if (home && variant === "bar") {
          if (router.canGoBack()) router.back()
          else router.replace("/")
        } else if (home) {
          router.dismissTo("/")
        } else if (menuPositionOf(pathname)?.tab === tab) {
          // From a detail of this tab (the rail shows on every screen): back
          // to the tab's root rather than a second copy of it.
          router.dismissTo(menuTabTargets[tab].href)
        } else {
          router.replace(menuTabTargets[tab].href)
        }
      }}
    />
  )
}

/**
 * One entry of the bar or the rail: a tab's link or Home's button, an icon
 * named by its label. In the bar the icon cross-fades from muted to
 * `onAccent` as the pill arrives under it; in the rail the entry itself
 * takes the soft accent and the accent text color.
 */
function MenuNavEntry({
  icon,
  label,
  role,
  active,
  variant,
  onPress,
}: {
  readonly icon: LucideIcon
  /** Already translated. */
  readonly label: string
  readonly role: "tab" | "button"
  readonly active: boolean
  readonly variant: "bar" | "rail"
  readonly onPress: () => void
}) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0))
  useEffect(() => {
    slideTo(progress, active ? 1 : 0)
  }, [active, progress])
  const rail = variant === "rail"
  const iconSize = rail ? 24 : 20

  return (
    <View
      flex={rail ? undefined : 1}
      minH={rail ? railEntryHeight : control.md}
      items="center"
      justify="center"
      py={rail ? 8 : 0}
      px={rail ? 4 : 0}
      rounded={shape.control}
      bg={
        rail
          ? active
            ? "accent"
            : "transparent press:neutral-soft"
          : "transparent"
      }
      cursor="web:pointer"
      onPress={onPress}
      accessible
      role={role}
      aria-label={label}
      aria-selected={role === "tab" ? active : undefined}
      aria-current={active ? "page" : undefined}
      {...(Platform.OS === "web" ? { title: label } : {})}
    >
      {rail ? (
        <Icon
          icon={icon}
          size={iconSize}
          color={active ? "accent-text" : "muted-foreground"}
        />
      ) : (
        <View w={iconSize} h={iconSize}>
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
            <Icon icon={icon} size={iconSize} color="primary-foreground" />
          </Animated.View>
        </View>
      )}
    </View>
  )
}
