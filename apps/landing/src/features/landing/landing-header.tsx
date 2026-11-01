import {
  HouseIcon,
  LanguagesIcon,
  type LucideIcon,
  MailIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  PlayIcon,
  ReceiptTextIcon,
  SunIcon,
} from "lucide-react"
import { flushSync } from "react-dom"

type Theme = "system" | "light" | "dark"

import { languageOptions } from "@payky/web-shared/language-options"
import { buttonVariants } from "@/components/ui/button.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import {
  landingAppEntryUrl,
  landingEetPaths,
  landingPaths,
} from "@/core/landing-site.ts"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import { useLandingTheme } from "@/features/landing/use-landing-theme.ts"
import type { Language, TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"

const themeIcons = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} satisfies Record<Theme, LucideIcon>

const themeLabelKeys = {
  system: "settings.theme.system.title",
  light: "settings.theme.light.title",
  dark: "settings.theme.dark.title",
} satisfies Record<Theme, TranslationKey>

/** Auto, light, dark, and round again, as the app's own setting does. */
const nextTheme = {
  system: "light",
  light: "dark",
  dark: "system",
} satisfies Record<Theme, Theme>

interface MenuLink {
  readonly label: TranslationKey
  readonly icon: LucideIcon
  readonly href: string
  readonly active: boolean
}

/**
 * The header's menu: the home page, the EET page (landing/0006) and the
 * home page's contact form, which only the home page carries (landing/0010).
 * The page on how Payky works is linked from the footer (landing/0008).
 */
function useMenuLinks(): ReadonlyArray<MenuLink> {
  const { language, paths } = useLandingTranslation()
  return [
    {
      label: "landing.menu.home",
      icon: HouseIcon,
      href: landingPaths[language],
      active: paths === landingPaths,
    },
    {
      label: "landing.menu.eet",
      icon: ReceiptTextIcon,
      href: landingEetPaths[language],
      active: paths === landingEetPaths,
    },
    {
      label: "landing.menu.contact",
      icon: MailIcon,
      href: `${landingPaths[language]}#contact`,
      active: false,
    },
  ]
}

const iconButtonClassName = cn(
  buttonVariants({ variant: "ghost", size: "icon-lg" }),
  "rounded-full text-muted-foreground hover:text-foreground"
)

/**
 * Applies a theme change as a circle growing out of `origin` (landing.css),
 * or at once where View Transitions are missing or motion is reduced.
 */
function switchTheme(origin: Element, apply: () => void) {
  if (
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    apply()
    return
  }
  const rect = origin.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )
  const root = document.documentElement.style
  root.setProperty("--landing-theme-x", `${x}px`)
  root.setProperty("--landing-theme-y", `${y}px`)
  root.setProperty("--landing-theme-r", `${radius}px`)
  // Synchronous, so the `dark` class is on before the new snapshot is taken.
  document.startViewTransition(() => flushSync(apply))
}

/**
 * Brand and menu on the left; on the right the one action, the language and
 * the appearance. The menu's links sit in the bar on wide screens and behind
 * a menu button on narrow ones. The header's button goes straight into the
 * app, as the hero's does.
 */
export function LandingHeader() {
  const { language, setLanguage, t } = useLandingTranslation()
  const [theme, setTheme] = useLandingTheme()
  const ThemeIcon = themeIcons[theme]
  const themeLabel = `${t("landing.theme.label")}: ${t(themeLabelKeys[theme])}`
  const menuLinks = useMenuLinks()

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a
          href={landingPaths[language]}
          className="inline-flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight"
          aria-label={t("app.name")}
        >
          <img src="/landing/pwa-icon.svg" alt="" className="size-8 shrink-0" />
          {/* The smallest phones need the room for the menu button. */}
          <span className="hidden min-[380px]:inline">{t("app.name")}</span>
        </a>

        <nav
          aria-label={t("landing.menu.label")}
          className="mr-auto ml-8 hidden items-center gap-1 md:flex"
        >
          {menuLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              data-label={t(link.label)}
              // The hidden `after` copy reserves the bold label's width, so the
              // menu is as wide on every page. `before` is the active underline.
              className={cn(
                "relative inline-flex flex-col items-center px-3 py-2 text-sm font-medium text-muted-foreground transition-colors after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)] hover:text-foreground",
                link.active &&
                  "font-semibold text-foreground before:absolute before:inset-x-3 before:bottom-0.5 before:h-0.5 before:rounded-full before:bg-primary"
              )}
            >
              {t(link.label)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <a
            // A plain link: the app is another document (landing/0003).
            href={landingAppEntryUrl(language)}
            className={cn(
              buttonVariants({ size: "lg" }),
              "mr-2 rounded-full px-4 font-semibold has-data-[icon=inline-start]:pl-3.5"
            )}
          >
            <PlayIcon aria-hidden="true" data-icon="inline-start" />
            {t("landing.cta.startShort")}
          </a>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(iconButtonClassName, "md:hidden")}
              aria-label={t("landing.menu.label")}
              title={t("landing.menu.label")}
            >
              <MenuIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            {/* Portalled out of the page: `landing` brings its gold along. */}
            <DropdownMenuContent align="end" className="landing min-w-48">
              {menuLinks.map((link) => {
                const Icon = link.icon
                return (
                  <DropdownMenuItem
                    key={link.label}
                    className={cn(
                      "gap-2.5 px-2.5 py-2",
                      link.active && "font-semibold"
                    )}
                    render={
                      <a
                        href={link.href}
                        aria-current={link.active ? "page" : undefined}
                      />
                    }
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "text-muted-foreground",
                        link.active && "text-(--landing-ink)"
                      )}
                    />
                    {t(link.label)}
                    {link.active ? (
                      <span
                        aria-hidden="true"
                        className="ml-auto size-2 rounded-full bg-primary"
                      />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={iconButtonClassName}
              aria-label={t("landing.language.label")}
              title={t("landing.language.label")}
            >
              <LanguagesIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuRadioGroup
                value={language}
                onValueChange={(value) => setLanguage(value as Language)}
              >
                {languageOptions.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    className="py-1.5"
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            className={iconButtonClassName}
            aria-label={themeLabel}
            title={themeLabel}
            onClick={(event) =>
              switchTheme(event.currentTarget, () => setTheme(nextTheme[theme]))
            }
          >
            <ThemeIcon aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
