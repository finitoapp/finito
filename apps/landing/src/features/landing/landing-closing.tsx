import { useEventListener } from "@dedalik/use-react"
import { rememberInstallLanguage } from "@payky/web-shared/landing-redirect"
import {
  ChevronDownIcon,
  DownloadIcon,
  GlobeIcon,
  type LucideIcon,
  MonitorDownIcon,
  PlayIcon,
  SmartphoneIcon,
  ThumbsUpIcon,
  ZapIcon,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge.tsx"
import { buttonVariants } from "@/components/ui/button.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import {
  installsFromLanding,
  landingAppEntryUrl,
  landingSite,
} from "@/core/landing-site.ts"
import { LandingContactForm } from "@/features/landing/landing-contact-form.tsx"
import {
  promptInstall,
  useInstallPrompt,
} from "@/features/landing/landing-install-prompt.ts"
import { Reveal } from "@/features/landing/landing-parts.tsx"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import type { TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"

interface GetOption {
  readonly id: "zapstore" | "apk" | "install" | "web"
  readonly icon: LucideIcon
  readonly label: TranslationKey
  readonly hint: TranslationKey
}

interface GetGroup {
  readonly id: "native" | "webBased"
  readonly icon: LucideIcon
  readonly title: TranslationKey
  readonly body: TranslationKey
  readonly action: TranslationKey
  readonly actionIcon: LucideIcon
  /** The way Payky recommends: the full app (landing/0005). */
  readonly recommended?: true
  readonly options: ReadonlyArray<GetOption>
}

/** The four ways into the app, native and web-based (landing/0005). */
const getGroups: ReadonlyArray<GetGroup> = [
  {
    id: "native",
    icon: SmartphoneIcon,
    title: "landing.closing.get.native.title",
    body: "landing.closing.get.native.body",
    action: "landing.closing.get.native.action",
    actionIcon: DownloadIcon,
    recommended: true,
    options: [
      {
        id: "zapstore",
        icon: ZapIcon,
        label: "landing.closing.get.zapstore.label",
        hint: "landing.closing.get.zapstore.hint",
      },
      {
        id: "apk",
        icon: DownloadIcon,
        label: "landing.closing.get.apk.label",
        hint: "landing.closing.get.apk.hint",
      },
    ],
  },
  {
    id: "webBased",
    icon: GlobeIcon,
    title: "landing.closing.get.webBased.title",
    body: "landing.closing.get.webBased.body",
    action: "landing.closing.get.webBased.action",
    actionIcon: PlayIcon,
    options: [
      {
        id: "install",
        icon: MonitorDownIcon,
        label: "landing.closing.get.install.label",
        hint: "landing.closing.get.install.hint",
      },
      {
        id: "web",
        icon: GlobeIcon,
        label: "landing.closing.get.web.label",
        hint: "landing.closing.get.web.hint",
      },
    ],
  },
]

/**
 * Whether this landing offers `option`: Zapstore only for an app listed there,
 * installing from the page only where it shares the app's origin
 * (landing/0013); elsewhere the web app itself offers the install.
 */
const isOffered = (option: GetOption): boolean =>
  option.id === "zapstore"
    ? landingSite.zapstoreUrl !== null
    : option.id === "install"
      ? installsFromLanding
      : true

// Outlined: the contact form below holds the one primary action of the section.
const actionClassName = cn(
  buttonVariants({ variant: "outline", size: "lg" }),
  "mt-auto h-11 w-fit rounded-full px-6 text-base font-semibold has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5"
)

/** "We'll help you": the one thing the page asks for, a way to reach the sender. */
function HelpYou() {
  const { t } = useLandingTranslation()

  return (
    <article className="landing-beam grid gap-8 rounded-3xl p-6 shadow-sm sm:p-10 lg:grid-cols-[2fr_3fr] lg:gap-14">
      <div className="flex flex-col gap-4">
        <h2 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          {t("landing.closing.contact.title")}
        </h2>
        <p className="text-lg leading-relaxed text-pretty text-muted-foreground">
          {t("landing.closing.contact.body")}
        </p>
      </div>
      {/* The menu's #contact lands on the form itself, not on the heading above it. */}
      <div id="contact" className="scroll-mt-24">
        <LandingContactForm />
      </div>
    </article>
  )
}

/** Installing the app: the ways in, native and web-based. */
function GetTheApp() {
  const { language, t } = useLandingTranslation()
  const installPrompt = useInstallPrompt()
  const [installNote, setInstallNote] = useState<TranslationKey | null>(null)

  // Fires however the app was installed, the browser's menu included.
  useEventListener("appinstalled", () => {
    rememberInstallLanguage(language)
    setInstallNote("landing.closing.get.install.done")
  })

  // The browser's own install dialog where it offers one (Chromium), else how
  // to install by hand: Safari and Firefox have no such offer to show.
  const install = () => {
    if (installPrompt === null) {
      setInstallNote("landing.closing.get.install.manual")
    } else {
      void promptInstall(installPrompt)
    }
  }

  const links = {
    zapstore: {
      href: landingSite.zapstoreUrl ?? undefined,
      target: "_blank",
      rel: "noopener noreferrer",
    },
    apk: { href: landingSite.apkUrl },
    // The app is another document than this prerendered page, and starts in
    // this page's language (landing/0003).
    web: { href: landingAppEntryUrl(language) },
  } satisfies Record<Exclude<GetOption["id"], "install">, object>

  return (
    <article
      id="download"
      className="flex scroll-mt-24 flex-col gap-8 rounded-3xl bg-muted/50 p-6 sm:p-10"
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("landing.closing.get.title")}
        </h2>
        <p className="max-w-2xl leading-relaxed text-pretty text-muted-foreground">
          {t("landing.closing.get.body")}
        </p>
      </div>
      <ul className="grid gap-8 md:grid-cols-2 md:gap-10">
        {getGroups.map((group) => {
          const Icon = group.icon
          const ActionIcon = group.actionIcon
          return (
            <li key={group.id} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-(--landing-ink)">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-lg font-semibold">{t(group.title)}</h3>
                  {group.recommended ? (
                    <Badge>
                      <ThumbsUpIcon
                        aria-hidden="true"
                        data-icon="inline-start"
                      />
                      {t("landing.closing.get.recommended")}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <p className="leading-relaxed text-pretty text-muted-foreground">
                {t(group.body)}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger className={actionClassName}>
                  <ActionIcon aria-hidden="true" data-icon="inline-start" />
                  {t(group.action)}
                  <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-auto max-w-80">
                  {group.options.filter(isOffered).map((option) => {
                    const OptionIcon = option.icon
                    const content = (
                      <>
                        <OptionIcon
                          aria-hidden="true"
                          className="mt-0.5 self-start"
                        />
                        <span className="flex flex-col">
                          <span className="font-medium">{t(option.label)}</span>
                          <span className="text-xs text-muted-foreground">
                            {t(option.hint)}
                          </span>
                        </span>
                      </>
                    )
                    return option.id === "install" ? (
                      <DropdownMenuItem
                        key={option.id}
                        className="gap-2.5 px-2.5 py-2"
                        onClick={install}
                      >
                        {content}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        key={option.id}
                        className="gap-2.5 px-2.5 py-2"
                        render={<a {...links[option.id]} />}
                      >
                        {content}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {group.id === "webBased" && installNote !== null ? (
                <p
                  role="status"
                  className="leading-relaxed text-pretty text-muted-foreground"
                >
                  {t(installNote)}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </article>
  )
}

export function LandingClosing() {
  return (
    <section
      id="get-started"
      className="mx-auto flex max-w-6xl scroll-mt-16 flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <Reveal>
        <GetTheApp />
      </Reveal>
      <Reveal>
        <HelpYou />
      </Reveal>
    </section>
  )
}
