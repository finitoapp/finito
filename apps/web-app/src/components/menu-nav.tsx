import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { RouteAccess } from "@payky/core/modules/access/access-types"
import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import {
  Clock3Icon,
  HouseIcon,
  type LucideIcon,
  PackageIcon,
  SettingsIcon,
} from "lucide-react"
import { motion } from "motion/react"
import type { ReactNode } from "react"
import { useSlidingPillTransition } from "@/components/sliding-pill.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

/** A tab of the menu section, the screens behind home's hamburger (navigation/0001). */
export type MenuTab = "activity" | "catalog" | "settings"

/**
 * The tabs, in the order the bar and the sidebar draw them. A new tab is a
 * new row. `to` is the tab's root screen, the one it opens on; `permission`
 * is what that screen declares, so the router test can tell the two apart
 * from drifting. Every tab is shown whatever the device may open: a gated
 * one asks for the PIN through the access gate.
 */
export const menuTabs = {
  activity: {
    icon: Clock3Icon,
    labelKey: "nav.activity",
    to: "/activity",
    permission: "activity",
  },
  catalog: {
    icon: PackageIcon,
    labelKey: "nav.catalog",
    to: "/catalog/items",
    permission: "catalog",
  },
  settings: {
    icon: SettingsIcon,
    labelKey: "nav.settings",
    to: "/settings",
    permission: "free",
  },
} as const satisfies Record<
  MenuTab,
  {
    readonly icon: LucideIcon
    readonly labelKey: TranslationKey
    readonly to: string
    readonly permission: RouteAccess
  }
>

const menuTabOrder = Object.keys(menuTabs) as ReadonlyArray<MenuTab>

/**
 * The menu section's navigation: a bottom bar on a phone, drawn only on a
 * tab's root screen, and a left sidebar on a large monitor, drawn on every
 * screen of the section. The bar shows icons alone, each named by its
 * label for assistive tech; the sidebar spells the labels out. Both open
 * with Home, the way out of the section, ahead of the tabs. `_terminal.tsx`
 * mounts it and reserves its room through `--menu-nav-height` and
 * `--menu-sidebar-width`. Switching tabs replaces the history entry, so
 * Back and Home leave the section instead of rewinding through tabs.
 */
export function MenuNav({
  active,
  root,
}: {
  readonly active: MenuTab
  readonly root: boolean
}) {
  const { t } = useTranslation()

  return (
    <>
      {root ? (
        <nav
          aria-label={t("nav.menu")}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
        >
          <ul className="mx-auto flex h-12 max-w-xl items-stretch">
            <li className="flex flex-1">
              <MenuHomeEntry compact />
            </li>
            {menuTabOrder.map((tab) => (
              <li key={tab} className="flex flex-1">
                <MenuNavLink tab={tab} active={tab === active} compact />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <nav
        aria-label={t("nav.menu")}
        className="fixed bottom-0 left-0 z-40 hidden w-(--menu-sidebar-width) border-r border-border bg-background pb-[env(safe-area-inset-bottom,0px)] lg:block"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + var(--terminal-banner-height, 0px))",
        }}
      >
        <ul className="flex flex-col gap-1 p-3">
          <li>
            <MenuHomeEntry compact={false} />
          </li>
          {menuTabOrder.map((tab) => (
            <li key={tab}>
              <MenuNavLink tab={tab} active={tab === active} compact={false} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

/**
 * Home, ahead of the tabs: it leaves the section the way it was entered
 * (navigation/0001). The section opens from home and its tab switches
 * replace the history entry, so going back returns there; a URL opened
 * directly has nothing to go back to, and goes home instead. It is never
 * the active entry: home is not part of the section.
 */
function MenuHomeEntry({ compact }: { readonly compact: boolean }) {
  const router = useRouter()
  const navigate = useNavigate()

  return (
    <MenuNavEntry
      icon={HouseIcon}
      labelKey="nav.home"
      active={false}
      compact={compact}
      render={(props) => (
        <button
          type="button"
          {...props}
          onClick={() => {
            if (router.history.canGoBack()) {
              router.history.back()
            } else {
              void navigate({ to: "/", replace: true })
            }
          }}
        />
      )}
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
  const { icon, labelKey, to } = menuTabs[tab]

  return (
    <MenuNavEntry
      icon={icon}
      labelKey={labelKey}
      active={active}
      compact={compact}
      render={(props) => <Link to={to} replace {...props} />}
    />
  )
}

interface MenuNavEntryElementProps {
  readonly "aria-label"?: string
  readonly "aria-current"?: "page"
  readonly className: string
  readonly children: ReactNode
}

/**
 * One entry of the bar or the sidebar, drawn through `render` as the
 * element that acts (a tab's link, Home's button). Motion, on
 * `sliding-pill.tsx`'s spring: the active tab's marker (a small
 * half-circle bubble under the bar's icon, flat side down, the row's
 * background in the sidebar) slides from the tab that had it (`layoutId`,
 * so it travels because the nav stays mounted across the tab routes), the
 * bar's centred icon grows to 1.1 and rises 4 px over the marker while the
 * color fades to primary, and a press dips the icon to 0.9. Reduced motion
 * switches at once and drops the press dip.
 */
function MenuNavEntry({
  icon: Icon,
  labelKey,
  active,
  compact,
  render,
}: {
  readonly icon: LucideIcon
  readonly labelKey: TranslationKey
  readonly active: boolean
  readonly compact: boolean
  readonly render: (props: MenuNavEntryElementProps) => ReactNode
}) {
  const { t } = useTranslation()
  const transition = useSlidingPillTransition()

  return render({
    "aria-label": compact ? t(labelKey) : undefined,
    "aria-current": active ? "page" : undefined,
    className: cn(
      "group relative isolate flex flex-1 cursor-pointer items-center rounded-lg text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
      compact
        ? "justify-center px-1"
        : "gap-3 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50",
      active && "text-primary hover:text-primary"
    ),
    children: (
      <>
        {active ? (
          <motion.span
            aria-hidden="true"
            layoutId={compact ? "menu-bar-marker" : "menu-sidebar-marker"}
            transition={transition}
            className={
              compact
                ? "absolute bottom-0.5 left-1/2 h-1.5 w-3 -translate-x-1/2 bg-primary"
                : "absolute inset-0 -z-10 bg-muted"
            }
            // Inline, as motion scale-corrects only inline radii.
            style={
              compact
                ? { borderTopLeftRadius: 6, borderTopRightRadius: 6 }
                : { borderRadius: 8.8 }
            }
          />
        ) : null}
        <motion.span
          aria-hidden="true"
          className="flex shrink-0 transition-[scale] duration-150 group-active:scale-90 motion-reduce:transition-none motion-reduce:group-active:scale-100"
          animate={
            compact && active ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }
          }
          transition={transition}
        >
          <Icon
            className={compact ? "size-6" : "size-5"}
            strokeWidth={active ? 2.75 : 2}
          />
        </motion.span>
        {compact ? null : <span className="truncate">{t(labelKey)}</span>}
      </>
    ),
  })
}
