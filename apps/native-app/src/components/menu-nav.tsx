import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { router, usePathname } from "expo-router"
import type { LucideIcon } from "lucide-react-native"
import Bell from "lucide-react-native/icons/bell"
import Calculator from "lucide-react-native/icons/calculator"
import Clock3 from "lucide-react-native/icons/clock-3"
import Settings from "lucide-react-native/icons/settings"
import { Suspense, useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Image,
  Platform,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme, View, XStack, YStack } from "tamagui"
import appIcon from "../../assets/app-icon.png"
import {
  type MenuTab,
  menuPositionOf,
  menuTabOrder,
  menuTabTargets,
} from "../core/menu-routes.ts"
import { useActiveNotifications } from "../hooks/use-active-notifications.ts"
import {
  useNostrIdentity,
  useNostrProfile,
} from "../hooks/use-nostr-profile.ts"
import { useTranslation } from "../hooks/use-translation.ts"
import { control, maxWidth, shape } from "../theme/tokens.ts"
import { animateTo } from "./motion.ts"
import { Icon } from "./ui/icon.tsx"
import { NotificationDot } from "./ui/notification-dot.tsx"

/** The phone bar's height above the safe area: Linky's `TabBar`, 44 tabs in a `py-1` row. */
export const menuBarHeight = control.md + 8

/** The wide window's rail, Linky's `NavigationRail` (`$hero`, 112). */
export const menuSidebarWidth = 112

/** Linky's `wide` breakpoint, from which the rail replaces the bottom bar. */
export const menuSidebarMinWidth = 961

const menuTabFaces = {
  terminal: { icon: Calculator, labelKey: "nav.home" },
  activity: { icon: Clock3, labelKey: "nav.activity" },
  notifications: { icon: Bell, labelKey: "nav.notifications" },
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
 * the rail beside its stack and the bar over it (`MenuBar`), and keeps
 * either mounted across the tab routes, which is what lets the pill travel.
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
 * measured), `index` the active tab. The first measure places it at once,
 * and so does a bar coming back from hidden, which arrives on its tab
 * rather than sliding from the one it left on.
 */
function usePillOffset(index: number, step: number, visible: boolean) {
  const [offset] = useState(() => new Animated.Value(0))
  const shown = useRef(false)
  useEffect(() => {
    if (step === 0) return
    const target = index * step
    if (shown.current) slideTo(offset, target)
    else offset.setValue(target)
    shown.current = visible
  }, [index, step, visible, offset])
  return offset
}

/** The bar's quick slide in from below the screen and back out. */
const barEnter = { duration: 160, easing: Easing.out(Easing.cubic) }
const barExit = { duration: 140, easing: Easing.in(Easing.cubic) }

/**
 * The phone's bottom bar, drawn over the stack rather than beside it, so
 * showing or hiding it never resizes the screen under it: going from home
 * to Activity used to shrink home for a frame before Activity arrived.
 * The screens that have the bar keep its room themselves
 * (`MenuBarSpacer`). It slides in on `tab` and out on `undefined`, keeping
 * the tab it left on while it goes; mounted throughout, so the pill can
 * travel between tabs.
 *
 * A pressed entry answers at once: the pill sets off to it in that frame,
 * while the route takes a few more (Expo Router queues the navigation and
 * the root layout re-renders on the new path). Any route change brings the
 * pill back in line with the route.
 */
export function MenuBar({ tab }: { readonly tab: MenuTab | undefined }) {
  const insets = useSafeAreaInsets()
  const visible = tab !== undefined
  const [lastTab, setLastTab] = useState<MenuTab>(tab ?? "terminal")
  const [lastRouted, setLastRouted] = useState(tab)
  if (tab !== lastRouted) {
    setLastRouted(tab)
    if (tab !== undefined) setLastTab(tab)
  }
  const [hidden] = useState(() => new Animated.Value(visible ? 0 : 1))
  useEffect(() => {
    animateTo(hidden, visible ? 0 : 1, visible ? barEnter : barExit)
  }, [visible, hidden])
  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      aria-hidden={!visible}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        // Gone once it is all the way down: should a page ever end above
        // the screen's bottom edge, the bar slid below it must not show
        // there as a strip of tabs that take no presses.
        opacity: hidden.interpolate({
          inputRange: [0, 0.99, 1],
          outputRange: [1, 1, 0],
        }),
        transform: [
          {
            translateY: hidden.interpolate({
              inputRange: [0, 1],
              outputRange: [0, menuBarHeight + insets.bottom],
            }),
          },
        ],
      }}
    >
      <MenuNav
        active={lastTab}
        variant="bar"
        visible={visible}
        onSelect={setLastTab}
      />
    </Animated.View>
  )
}

/**
 * The room a screen with the bar leaves at its bottom for `MenuBar`, which
 * draws over it; nothing on a wide window, which has the rail instead. It
 * sits inside the screen's safe area, which already keeps the bottom inset
 * the bar pads itself with.
 */
export function MenuBarSpacer() {
  const wide = useWindowDimensions().width >= menuSidebarMinWidth
  return wide ? null : <View h={menuBarHeight} shrink={0} />
}

/** Linky's rail entries: `$row` (64) high, `gap-2` apart, `px-1 py-2`. */
const railEntryHeight = 64
const railGap = 4
/** Linky's rail header: Fazole's 44 logo tile, `mb-5` above the entries. */
const railLogoSize = 44

export function MenuNav({
  active,
  variant,
  visible = true,
  onSelect,
}: {
  readonly active: MenuTab
  readonly variant: "bar" | "sidebar"
  /** False while the bar is hidden: it comes back with the pill in place. */
  readonly visible?: boolean
  /** Hears an entry as it is pressed, before the route follows. */
  readonly onSelect?: (tab: MenuTab) => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const index = menuTabOrder.indexOf(active)
  const [tabWidth, setTabWidth] = useState(0)
  const barOffset = usePillOffset(index, tabWidth, visible)

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
      bg="nav-bar"
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
            onSelect={onSelect}
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
  onSelect,
}: {
  readonly tab: MenuTab
  readonly active: boolean
  readonly variant: "bar" | "rail"
  readonly onSelect?: ((tab: MenuTab) => void) | undefined
}) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const { icon, labelKey } = menuTabFaces[tab]
  // The notifications' tab carries their dot (home's hamburger the same).
  const unread = useActiveNotifications().length > 0 && tab === "notifications"
  // The terminal's entry on the bar is Home: it leaves the section the way
  // it was entered, as web's `MenuHomeEntry` (navigation/0001). The section
  // opens from home and its tab switches replace the screen, so going back
  // returns there; a screen opened cold goes home instead. On the rail,
  // which the terminal's own screens share, it dismisses to home.
  const home = tab === "terminal"
  return (
    <MenuNavEntry
      icon={icon}
      label={t(unread ? "nav.notificationsUnread" : labelKey)}
      dot={unread}
      role={home && variant === "bar" ? "button" : "tab"}
      active={active}
      variant={variant}
      onPress={() => {
        if (active) return
        onSelect?.(tab)
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
 * takes the soft accent and the accent text color. `dot` puts the
 * notification dot on the icon's corner, in the pill's foreground on the
 * active bar entry, where a primary dot would vanish into the pill.
 */
function MenuNavEntry({
  icon,
  label,
  dot,
  role,
  active,
  variant,
  onPress,
}: {
  readonly icon: LucideIcon
  /** Already translated. */
  readonly label: string
  readonly dot: boolean
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
        <View>
          <Icon
            icon={icon}
            size={iconSize}
            color={active ? "accent-text" : "muted-foreground"}
          />
          {dot ? <NotificationDot /> : null}
        </View>
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
          {dot ? (
            <NotificationDot
              color={active ? "primary-foreground" : "primary"}
            />
          ) : null}
        </View>
      )}
    </View>
  )
}
