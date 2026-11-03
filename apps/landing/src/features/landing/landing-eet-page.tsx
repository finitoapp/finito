import {
  ArrowRightIcon,
  CalendarClockIcon,
  CheckIcon,
  FileTextIcon,
  type LucideIcon,
  PercentIcon,
  PlayIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TimerIcon,
  Undo2Icon,
  WifiOffIcon,
  XIcon,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button.tsx"
import { landingAppEntryUrl, landingEetPaths } from "@/core/landing-site.ts"
import {
  Faq,
  type FaqItem,
  LandingShell,
} from "@/features/landing/landing-page.tsx"
import {
  Band,
  bodyClassName,
  Eyebrow,
  type IconCard,
  IconGrid,
  primaryActionClassName,
  Reveal,
  SectionHeading,
} from "@/features/landing/landing-parts.tsx"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import type { Language, TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"

interface Step {
  readonly title: TranslationKey
  readonly body: TranslationKey
  readonly link?: { readonly label: TranslationKey; readonly href: string }
}

interface TimelineItem extends Step {
  readonly date: TranslationKey
}

// Every fact on this page comes from eet.gov.cz as of the date the source
// line names; what could not be confirmed there is listed in landing/0007.
export const eetSourceUrl = "https://eet.gov.cz"
const eetExemptionsUrl =
  "https://eet.gov.cz/cs/koho-se-eet-tyka/co-je-z-evidence-trzeb-vyjmuto"

const timeline: ReadonlyArray<TimelineItem> = [
  {
    date: "landing.eet.timeline.registration.date",
    title: "landing.eet.timeline.registration.title",
    body: "landing.eet.timeline.registration.body",
  },
  {
    date: "landing.eet.timeline.start.date",
    title: "landing.eet.timeline.start.title",
    body: "landing.eet.timeline.start.body",
  },
]

const recorded: ReadonlyArray<TranslationKey> = [
  "landing.eet.scope.yes.cash",
  "landing.eet.scope.yes.card",
  "landing.eet.scope.yes.qr",
  "landing.eet.scope.yes.crypto",
  "landing.eet.scope.yes.vouchers",
]

const notRecorded: ReadonlyArray<TranslationKey> = [
  "landing.eet.scope.no.eshop",
  "landing.eet.scope.no.invoice",
  "landing.eet.scope.no.private",
]

const changes: ReadonlyArray<IconCard> = [
  {
    icon: FileTextIcon,
    title: "landing.eet.changes.data.title",
    body: "landing.eet.changes.data.body",
  },
  {
    icon: ReceiptTextIcon,
    title: "landing.eet.changes.receipt.title",
    body: "landing.eet.changes.receipt.body",
  },
  {
    icon: SmartphoneIcon,
    title: "landing.eet.changes.cards.title",
    body: "landing.eet.changes.cards.body",
  },
  {
    icon: WifiOffIcon,
    title: "landing.eet.changes.offline.title",
    body: "landing.eet.changes.offline.body",
  },
  {
    icon: PercentIcon,
    title: "landing.eet.changes.credit.title",
    body: "landing.eet.changes.credit.body",
  },
]

const officeSteps: ReadonlyArray<Step> = [
  {
    title: "landing.eet.prepare.dis.title",
    body: "landing.eet.prepare.dis.body",
  },
  {
    title: "landing.eet.prepare.unit.title",
    body: "landing.eet.prepare.unit.body",
  },
  {
    title: "landing.eet.prepare.certificate.title",
    body: "landing.eet.prepare.certificate.body",
  },
]

const paykySteps: ReadonlyArray<Step> = [
  {
    title: "landing.eet.setup.dis.title",
    body: "landing.eet.setup.dis.body",
    link: { label: "landing.eet.setup.dis.link", href: "#dis" },
  },
  {
    title: "landing.eet.setup.certificate.title",
    body: "landing.eet.setup.certificate.body",
  },
  {
    title: "landing.eet.setup.unit.title",
    body: "landing.eet.setup.unit.body",
  },
  { title: "landing.eet.setup.tip.title", body: "landing.eet.setup.tip.body" },
  {
    title: "landing.eet.setup.test.title",
    body: "landing.eet.setup.test.body",
  },
  { title: "landing.eet.setup.on.title", body: "landing.eet.setup.on.body" },
]

const handled: ReadonlyArray<IconCard> = [
  {
    icon: TimerIcon,
    title: "landing.eet.handles.background.title",
    body: "landing.eet.handles.background.body",
  },
  {
    icon: RotateCcwIcon,
    title: "landing.eet.handles.offline.title",
    body: "landing.eet.handles.offline.body",
  },
  {
    icon: Undo2Icon,
    title: "landing.eet.handles.refund.title",
    body: "landing.eet.handles.refund.body",
  },
  {
    icon: SmartphoneIcon,
    title: "landing.eet.handles.devices.title",
    body: "landing.eet.handles.devices.body",
  },
  {
    icon: CheckIcon,
    title: "landing.eet.handles.code.title",
    body: "landing.eet.handles.code.body",
  },
  {
    icon: ShieldCheckIcon,
    title: "landing.eet.handles.certificate.title",
    body: "landing.eet.handles.certificate.body",
  },
]

/** Also the prerendered page's FAQ structured data (landing/0006). */
export const eetFaqItems: ReadonlyArray<FaqItem> = [
  {
    question: "landing.eet.faq.device.question",
    answer: "landing.eet.faq.device.answer",
  },
  {
    question: "landing.eet.faq.offline.question",
    answer: "landing.eet.faq.offline.answer",
  },
  {
    question: "landing.eet.faq.receipt.question",
    answer: "landing.eet.faq.receipt.answer",
  },
  {
    question: "landing.eet.faq.card.question",
    answer: "landing.eet.faq.card.answer",
  },
  {
    question: "landing.eet.faq.bitcoin.question",
    answer: "landing.eet.faq.bitcoin.answer",
  },
  {
    question: "landing.eet.faq.tip.question",
    answer: "landing.eet.faq.tip.answer",
  },
  {
    question: "landing.eet.faq.refund.question",
    answer: "landing.eet.faq.refund.answer",
  },
  {
    question: "landing.eet.faq.certificate.question",
    answer: "landing.eet.faq.certificate.answer",
  },
  {
    question: "landing.eet.faq.units.question",
    answer: "landing.eet.faq.units.answer",
  },
  {
    question: "landing.eet.faq.off.question",
    answer: "landing.eet.faq.off.answer",
  },
  {
    question: "landing.eet.faq.price.question",
    answer: "landing.eet.faq.price.answer",
  },
]

const secondaryActionClassName = cn(
  buttonVariants({ variant: "secondary", size: "lg" }),
  "h-12 rounded-full px-6 text-base font-semibold has-data-[icon=inline-end]:pr-5"
)

function Hero() {
  const { language, t } = useLandingTranslation()
  return (
    <section className="landing-dots relative isolate overflow-hidden">
      <div className="mx-auto flex max-w-4xl flex-col gap-7 px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-24 lg:pb-24">
        <Eyebrow>{t("landing.eet.hero.eyebrow")}</Eyebrow>
        <h1 className="landing-rise text-5xl font-extrabold tracking-tight text-balance sm:text-6xl">
          {t("landing.eet.hero.title")}
        </h1>
        <p className="landing-rise landing-delay-1 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
          {t("landing.eet.hero.body")}
        </p>
        <div className="landing-rise landing-delay-2 flex flex-wrap gap-3">
          <a
            href={landingAppEntryUrl(language)}
            className={primaryActionClassName}
          >
            <PlayIcon aria-hidden="true" data-icon="inline-start" />
            {t("landing.eet.hero.start")}
          </a>
          <a href="#setup" className={secondaryActionClassName}>
            {t("landing.eet.hero.connect")}
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </a>
        </div>
        <p className="landing-rise landing-delay-3 max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
          {t("landing.eet.hero.note")}
        </p>
      </div>
    </section>
  )
}

function Timeline() {
  const { t } = useLandingTranslation()
  return (
    <Band muted>
      <SectionHeading
        eyebrow="landing.eet.timeline.eyebrow"
        title="landing.eet.timeline.title"
      />
      <ol className="mt-12 grid gap-6 md:grid-cols-2">
        {timeline.map((item) => (
          <Reveal key={item.date}>
            <li className="flex h-full flex-col gap-3 rounded-2xl bg-card p-6 shadow-sm">
              <span className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-(--landing-ink)">
                <CalendarClockIcon aria-hidden="true" className="size-4" />
                {t(item.date)}
              </span>
              <h3 className="text-xl font-semibold tracking-tight">
                {t(item.title)}
              </h3>
              <p className="leading-relaxed text-pretty text-muted-foreground">
                {t(item.body)}
              </p>
            </li>
          </Reveal>
        ))}
      </ol>
      <Reveal>
        <p className="mt-8 max-w-3xl leading-relaxed text-pretty text-muted-foreground">
          {t("landing.eet.timeline.note")}
        </p>
      </Reveal>
    </Band>
  )
}

function ScopeList({
  title,
  items,
  icon: Icon,
}: {
  readonly title: TranslationKey
  readonly items: ReadonlyArray<TranslationKey>
  readonly icon: LucideIcon
}) {
  const { t } = useLandingTranslation()
  return (
    <Reveal className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <h3 className="text-xl font-semibold tracking-tight">{t(title)}</h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 leading-relaxed">
            <Icon
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-(--landing-ink)"
            />
            <span>{t(item)}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  )
}

function Scope() {
  const { t } = useLandingTranslation()
  return (
    <Band>
      <SectionHeading
        eyebrow="landing.eet.scope.eyebrow"
        title="landing.eet.scope.title"
        body="landing.eet.scope.body"
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <ScopeList
          title="landing.eet.scope.yes.title"
          items={recorded}
          icon={CheckIcon}
        />
        <ScopeList
          title="landing.eet.scope.no.title"
          items={notRecorded}
          icon={XIcon}
        />
      </div>
      <Reveal>
        <p className="mt-8 max-w-3xl leading-relaxed text-pretty text-muted-foreground">
          {t("landing.eet.scope.exemptions")}{" "}
          <a
            className="font-semibold text-(--landing-ink) hover:underline"
            href={eetExemptionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("landing.eet.scope.exemptionsLink")}
          </a>
        </p>
      </Reveal>
      <Reveal className="mt-8 flex max-w-3xl flex-col gap-3 rounded-2xl bg-accent p-6">
        <h3 className="text-xl font-semibold tracking-tight">
          {t("landing.eet.scope.off.title")}
        </h3>
        <p className="leading-relaxed text-pretty">
          {t("landing.eet.scope.off.body")}
        </p>
      </Reveal>
    </Band>
  )
}

function Changes() {
  return (
    <Band>
      <SectionHeading
        eyebrow="landing.eet.changes.eyebrow"
        title="landing.eet.changes.title"
      />
      <IconGrid items={changes} />
    </Band>
  )
}

function NumberedSteps({ steps }: { readonly steps: ReadonlyArray<Step> }) {
  const { t } = useLandingTranslation()
  return (
    <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, index) => (
        <Reveal key={step.title}>
          <li className="flex h-full flex-col gap-3 rounded-2xl bg-card p-6 shadow-sm">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground"
            >
              {index + 1}
            </span>
            <h3 className="text-xl font-semibold tracking-tight">
              {t(step.title)}
            </h3>
            <p className="leading-relaxed text-pretty text-muted-foreground">
              {t(step.body)}
            </p>
            {step.link === undefined ? null : (
              <a
                className="mt-auto font-semibold text-(--landing-ink) hover:underline"
                href={step.link.href}
              >
                {t(step.link.label)}
              </a>
            )}
          </li>
        </Reveal>
      ))}
    </ol>
  )
}

function Prepare() {
  return (
    <Band id="dis" muted>
      <SectionHeading
        eyebrow="landing.eet.prepare.eyebrow"
        title="landing.eet.prepare.title"
        body="landing.eet.prepare.body"
      />
      <NumberedSteps steps={officeSteps} />
    </Band>
  )
}

function Setup() {
  const { language, t } = useLandingTranslation()
  return (
    <Band id="setup" muted>
      <SectionHeading
        eyebrow="landing.eet.setup.eyebrow"
        title="landing.eet.setup.title"
        body="landing.eet.setup.body"
      />
      <NumberedSteps steps={paykySteps} />
      <Reveal className="landing-beam mt-10 flex flex-col gap-5 rounded-3xl p-6 shadow-sm sm:p-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("landing.eet.setup.sandbox.title")}
          </h3>
          <p className={bodyClassName}>{t("landing.eet.setup.sandbox.body")}</p>
        </div>
        <a
          href={landingAppEntryUrl(language)}
          className={cn(primaryActionClassName, "w-fit shrink-0")}
        >
          <PlayIcon aria-hidden="true" data-icon="inline-start" />
          {t("landing.cta.start")}
        </a>
      </Reveal>
    </Band>
  )
}

function Handles() {
  return (
    <Band>
      <SectionHeading
        eyebrow="landing.eet.handles.eyebrow"
        title="landing.eet.handles.title"
      />
      <IconGrid items={handled} />
    </Band>
  )
}

/** Where the facts come from and when they were checked (landing/0007). */
function Source() {
  const { t } = useLandingTranslation()
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
        {t("landing.eet.source")}{" "}
        <a
          className="font-semibold hover:underline"
          href={eetSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("landing.eet.sourceLink")}
        </a>
      </p>
    </section>
  )
}

/**
 * The EET 2.0 page: how to turn it on in Payky first, then the law in brief.
 * Bands alternate muted and plain in this order, starting muted below the
 * hero so the FAQ's muted band follows a plain one.
 */
export function LandingEetPage({ language }: { readonly language: Language }) {
  return (
    <LandingShell language={language} paths={landingEetPaths}>
      <Hero />
      <Setup />
      <Handles />
      <Timeline />
      <Scope />
      <Prepare />
      <Changes />
      <Faq items={eetFaqItems} />
      <Source />
    </LandingShell>
  )
}
