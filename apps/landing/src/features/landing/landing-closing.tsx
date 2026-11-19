import { useEventListener } from "@dedalik/use-react"
import { rememberInstallLanguage } from "@payky/web-shared/landing-redirect"
import { type LucideIcon, PlayIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button.tsx"
import { landingAppEntryUrl } from "@/core/landing-site.ts"
import { LandingContactForm } from "@/features/landing/landing-contact-form.tsx"
import { Glow, Reveal } from "@/features/landing/landing-parts.tsx"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import {
  nativeLinkProps,
  nativeOptions,
  useIsAndroid,
} from "@/features/landing/landing-ways-in.tsx"
import { cn } from "@/lib/utils.ts"

declare global {
  interface WindowEventMap {
    readonly appinstalled: Event
  }
}

const actionClassName = (primary: boolean) =>
  cn(
    buttonVariants({ variant: primary ? "default" : "secondary", size: "lg" }),
    "h-12 rounded-full px-7 text-base font-semibold has-data-[icon=inline-start]:pl-6"
  )

function ActionIcon({ icon: Icon }: { readonly icon: LucideIcon }) {
  return <Icon aria-hidden="true" data-icon="inline-start" />
}

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

/**
 * Getting the app, as Linky's landing has it: every way in at once, the
 * visitor's main one first and the only one filled in (landing/0016).
 */
function GetTheApp() {
  const { language, t } = useLandingTranslation()
  const isAndroid = useIsAndroid()
  const [recommended, ...otherNative] = nativeOptions

  // The browser installs the app from its own menu, where the landing shares
  // the app's manifest; the app then starts in this page's language.
  useEventListener("appinstalled", () => {
    rememberInstallLanguage(language)
  })

  const nativeButton = (
    option: (typeof nativeOptions)[number],
    primary: boolean
  ) => (
    <a
      key={option.id}
      {...nativeLinkProps(option)}
      className={actionClassName(primary)}
    >
      <ActionIcon icon={option.icon} />
      {t(option.label)}
    </a>
  )
  const webButton = (primary: boolean) => (
    // The app is another document than this prerendered page, and starts in
    // this page's language (landing/0003).
    <a
      key="web"
      href={landingAppEntryUrl(language)}
      className={actionClassName(primary)}
    >
      <ActionIcon icon={PlayIcon} />
      {t("landing.cta.startShort")}
    </a>
  )
  const nativeFirst = isAndroid && recommended !== undefined

  return (
    <div className="relative isolate flex flex-col items-center gap-10 py-8 text-center sm:py-12">
      <Glow size="40%" top="30%" left="50%" />
      <img src="/landing/pwa-icon.svg" alt="" className="size-24 sm:size-32" />
      <h2 className="text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
        {t("landing.closing.get.title")}
      </h2>
      <div className="flex flex-wrap justify-center gap-3">
        {nativeFirst
          ? [
              nativeButton(recommended, true),
              webButton(false),
              ...otherNative.map((option) => nativeButton(option, false)),
            ]
          : [
              webButton(true),
              ...nativeOptions.map((option) => nativeButton(option, false)),
            ]}
      </div>
    </div>
  )
}

/** Installing the app, the hero's "More options" lead here (landing/0016). */
export function LandingDownload() {
  return (
    <section
      id="download"
      className="mx-auto flex max-w-6xl scroll-mt-16 flex-col px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <Reveal>
        <GetTheApp />
      </Reveal>
    </section>
  )
}

/** The home page's end, after the FAQ: the contact form. */
export function LandingClosing() {
  return (
    <section
      id="get-started"
      className="mx-auto flex max-w-6xl scroll-mt-16 flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <Reveal>
        <HelpYou />
      </Reveal>
    </section>
  )
}
