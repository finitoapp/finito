import { rememberLandingLanguage } from "@payky/web-shared/landing-redirect"
import {
  ArrowRightIcon,
  BanknoteIcon,
  ChevronDownIcon,
  CodeIcon,
  DatabaseIcon,
  EyeOffIcon,
  FileXIcon,
  LockIcon,
  type LucideIcon,
  ReceiptTextIcon,
  WifiOffIcon,
  ZapIcon,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import {
  landingEetPaths,
  landingPaths,
  landingResources,
  landingTechPaths,
} from "@/core/landing-site.ts"
import { LandingClosing } from "@/features/landing/landing-closing.tsx"
import { LandingFeatureStory } from "@/features/landing/landing-feature-story.tsx"
import { LandingHeader } from "@/features/landing/landing-header.tsx"
import { LandingHero } from "@/features/landing/landing-hero.tsx"
import { Reveal } from "@/features/landing/landing-parts.tsx"
import {
  type LandingTranslation,
  LandingTranslationContext,
  useLandingTranslation,
} from "@/features/landing/landing-translation.ts"
import type { Language, TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"
import "@/features/landing/landing.css"

interface IconItem {
  readonly icon: LucideIcon
  readonly title: TranslationKey
  readonly body: TranslationKey
  /** Leads on to the page about it (landing/0006). */
  readonly link?: {
    readonly label: TranslationKey
    readonly href: Readonly<Record<Language, string>>
  }
}

export interface FaqItem {
  readonly question: TranslationKey
  readonly answer: TranslationKey
}

const notNeeded: ReadonlyArray<LucideIcon> = [FileXIcon, LockIcon, EyeOffIcon]

const moreItems: ReadonlyArray<IconItem> = [
  {
    icon: WifiOffIcon,
    title: "landing.more.offline.title",
    body: "landing.more.offline.body",
  },
  {
    icon: DatabaseIcon,
    title: "landing.more.data.title",
    body: "landing.more.data.body",
    link: { label: "landing.more.data.link", href: landingTechPaths },
  },
  {
    icon: ReceiptTextIcon,
    title: "landing.more.eet.title",
    body: "landing.more.eet.body",
    link: { label: "landing.more.eet.link", href: landingEetPaths },
  },
  {
    icon: BanknoteIcon,
    title: "landing.more.cash.title",
    body: "landing.more.cash.body",
  },
  {
    icon: ZapIcon,
    title: "landing.more.bitcoin.title",
    body: "landing.more.bitcoin.body",
  },
  {
    icon: CodeIcon,
    title: "landing.more.free.title",
    body: "landing.more.free.body",
  },
]

/** Also the prerendered page's FAQ structured data (landing/0002). */
export const faqItems: ReadonlyArray<FaqItem> = [
  {
    question: "landing.faq.catch.question",
    answer: "landing.faq.catch.answer",
  },
  {
    question: "landing.faq.money.question",
    answer: "landing.faq.money.answer",
  },
  {
    question: "landing.faq.eet.question",
    answer: "landing.faq.eet.answer",
  },
  {
    question: "landing.faq.terminal.question",
    answer: "landing.faq.terminal.answer",
  },
]

export const githubUrl = "https://github.com/finitoapp/finito"

const signalGroupUrl =
  "https://signal.group/#CjQKIG6htHfJxD15ue8bEu0uiIM9HZux-Na1TfwTFOv8iepLEhAM0yHv8qkvPC5FC9JhuTEs"

/** What a merchant does not need, as a one-line statement between the stories. */
function NotNeeded() {
  const { t } = useLandingTranslation()
  return (
    <section className="landing-grain bg-primary text-primary-foreground">
      <Reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col items-center gap-7 text-center">
          <div
            className="flex gap-7"
            role="img"
            aria-label={t("landing.noNeed.alt")}
          >
            {notNeeded.map((Icon) => (
              <Icon
                key={Icon.displayName}
                aria-hidden="true"
                className="size-8"
                strokeWidth={1.75}
              />
            ))}
          </div>
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-balance whitespace-pre-line sm:text-4xl lg:text-5xl">
            {t("landing.noNeed.title")}
          </h2>
        </div>
      </Reveal>
    </section>
  )
}

function More() {
  const { language, t } = useLandingTranslation()
  return (
    <section className="bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal>
          <h2 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            {t("landing.more.title")}
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {moreItems.map((item) => {
            const Icon = item.icon
            return (
              <Reveal key={item.title}>
                <article className="flex flex-col gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-(--landing-ink)">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">
                    {t(item.title)}
                  </h3>
                  <p className="leading-relaxed text-pretty text-muted-foreground">
                    {t(item.body)}
                  </p>
                  {item.link === undefined ? null : (
                    <a
                      className="inline-flex items-center gap-1 font-semibold text-(--landing-ink) hover:underline"
                      href={item.link.href[language]}
                    >
                      {t(item.link.label)}
                      <ArrowRightIcon aria-hidden="true" className="size-4" />
                    </a>
                  )}
                </article>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Questions that open one at a time; their answers stay in the markup. */
/** `muted` sets the band off, unless the band before it already is. */
export function Faq({
  items,
  muted = true,
}: {
  readonly items: ReadonlyArray<FaqItem>
  readonly muted?: boolean
}) {
  const { t } = useLandingTranslation()
  const [openFaq, setOpenFaq] = useState<TranslationKey | null>(null)

  return (
    <section className={cn(muted && "bg-muted/40")}>
      <Reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <h2 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            {t("landing.faq.title")}
          </h2>
          <div className="flex flex-col gap-3">
            {items.map((item) => {
              const isOpen = openFaq === item.question
              return (
                <Collapsible
                  key={item.question}
                  className="rounded-2xl bg-card px-5 shadow-sm"
                  open={isOpen}
                  onOpenChange={(nextOpen) => {
                    setOpenFaq(nextOpen ? item.question : null)
                  }}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-semibold">
                    <span>{t(item.question)}</span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={cn(
                        "size-5 shrink-0 text-(--landing-ink) transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>
                  {/* Rendered while closed too: the answers are in the prerendered
                      page and its FAQ structured data, and Ctrl+F opens them. */}
                  <CollapsibleContent
                    hiddenUntilFound
                    className="pb-5 leading-relaxed text-pretty whitespace-pre-line text-muted-foreground"
                  >
                    {t(item.answer)}
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function FooterLink({
  href,
  children,
}: {
  readonly href: string
  readonly children: string
}) {
  return (
    <a
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      href={href}
    >
      {children}
    </a>
  )
}

function Footer() {
  const { language, t } = useLandingTranslation()
  return (
    <footer className="bg-muted/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center lg:px-8">
        <div className="inline-flex items-center gap-2 text-base font-bold tracking-tight">
          <img src="/landing/pwa-icon.svg" alt="" className="size-6 shrink-0" />
          <span>{t("app.name")}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {t("landing.footer.description")}
        </span>
        <div className="flex flex-wrap gap-5 md:ml-auto">
          <FooterLink href={landingTechPaths[language]}>
            {t("landing.footer.tech")}
          </FooterLink>
          <FooterLink href={githubUrl}>{t("landing.footer.github")}</FooterLink>
          <FooterLink href={signalGroupUrl}>
            {t("landing.footer.signal")}
          </FooterLink>
          <FooterLink href={landingPaths[language]}>
            {t("landing.footer.website")}
          </FooterLink>
        </div>
      </div>
    </footer>
  )
}

/**
 * What every landing page shares: the language of its address, the header
 * and the footer. `paths` are the page's addresses in every language
 * (landing/0002, landing/0006).
 */
export function LandingShell({
  language,
  paths,
  children,
}: {
  readonly language: Language
  readonly paths: Readonly<Record<Language, string>>
  readonly children: ReactNode
}) {
  const translation = useMemo<LandingTranslation>(
    () => ({
      language,
      paths,
      setLanguage: (next) => {
        rememberLandingLanguage(next)
        window.location.assign(paths[next])
      },
      t: (key) => landingResources[language][key],
    }),
    [language, paths]
  )

  // Scrolls to the element an address's #anchor names, such as the menu's
  // #contact. The browser's own jump misses it: where the page is rendered in
  // the browser (the dev server) the element does not exist yet when it looks,
  // and inside a Reveal still sliding in it aims at the element's 40px offset.
  // Measured by layout, which ignores that offset, and redone whenever the page
  // changes size while it settles, and on load, because until then the browser
  // keeps redoing its own jump. Stops once the visitor scrolls themselves.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1))
    const target = id === "" ? null : document.getElementById(id)
    if (target === null) return
    const scrollToTarget = () => {
      let top = 0
      for (
        let element: Element | null = target;
        element instanceof HTMLElement;
        element = element.offsetParent
      ) {
        top += element.offsetTop
      }
      window.scrollTo({
        top: top - Number.parseFloat(getComputedStyle(target).scrollMarginTop),
      })
    }
    const resizes = new ResizeObserver(scrollToTarget)
    resizes.observe(document.body)
    window.addEventListener("load", scrollToTarget)
    const userEvents = ["wheel", "touchstart", "keydown"] as const
    const stop = () => {
      resizes.disconnect()
      window.removeEventListener("load", scrollToTarget)
      for (const event of userEvents) window.removeEventListener(event, stop)
      window.clearTimeout(timeout)
    }
    for (const event of userEvents) window.addEventListener(event, stop)
    const timeout = window.setTimeout(stop, 3000)
    return stop
  }, [])

  return (
    <LandingTranslationContext.Provider value={translation}>
      <div className="landing min-h-svh bg-background text-foreground">
        <LandingHeader />
        <main>{children}</main>
        <Footer />
      </div>
    </LandingTranslationContext.Provider>
  )
}

export function LandingPage({ language }: { readonly language: Language }) {
  return (
    <LandingShell language={language} paths={landingPaths}>
      <LandingHero />
      <LandingFeatureStory />
      <NotNeeded />
      <More />
      <Faq items={faqItems} />
      <LandingClosing />
    </LandingShell>
  )
}
