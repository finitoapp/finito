import { useHash, useMediaQuery } from "@dedalik/use-react"
import {
  CalculatorIcon,
  type LucideIcon,
  ShoppingBasketIcon,
  UtensilsCrossedIcon,
} from "lucide-react"
import { type RefObject, useEffect, useRef, useState } from "react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx"
import {
  type MockupScreen,
  mockupHeight,
  mockupMarks,
  mockupsByLanguage,
  mockupWidth,
} from "@/features/landing/landing-mockups.ts"
import { Glow, Reveal } from "@/features/landing/landing-parts.tsx"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import type { TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"

interface Step {
  readonly screen: MockupScreen
  readonly title: TranslationKey
  readonly body: TranslationKey
}

type FlowId = "amount" | "bill" | "tables"

interface Flow {
  readonly id: FlowId
  readonly icon: LucideIcon
  /** The photo on its card, of the kind of place that sells this way. */
  readonly image: string
  readonly tab: TranslationKey
  /** Its label in the compact switcher that follows the story down. */
  readonly short: TranslationKey
  readonly audience: TranslationKey
  readonly steps: ReadonlyArray<Step>
}

/** The three ways of selling, from a typed amount up to a floor of tables. */
const flows: ReadonlyArray<Flow> = [
  {
    id: "amount",
    icon: CalculatorIcon,
    image: "/landing/craftsman.webp",
    tab: "landing.flows.amount.tab",
    short: "landing.flows.amount.short",
    audience: "landing.flows.amount.audience",
    steps: [
      {
        screen: "home",
        title: "landing.flows.amount.step1.title",
        body: "landing.flows.amount.step1.body",
      },
      {
        screen: "payment",
        title: "landing.flows.amount.step2.title",
        body: "landing.flows.amount.step2.body",
      },
      {
        screen: "paid",
        title: "landing.flows.amount.step3.title",
        body: "landing.flows.amount.step3.body",
      },
    ],
  },
  {
    id: "bill",
    icon: ShoppingBasketIcon,
    image: "/landing/seller.webp",
    tab: "landing.flows.bill.tab",
    short: "landing.flows.bill.short",
    audience: "landing.flows.bill.audience",
    steps: [
      {
        screen: "items",
        title: "landing.flows.bill.step1.title",
        body: "landing.flows.bill.step1.body",
      },
      {
        screen: "bill",
        title: "landing.flows.bill.step2.title",
        body: "landing.flows.bill.step2.body",
      },
      {
        screen: "payment",
        title: "landing.flows.bill.step3.title",
        body: "landing.flows.bill.step3.body",
      },
    ],
  },
  {
    id: "tables",
    icon: UtensilsCrossedIcon,
    image: "/landing/table-service.webp",
    tab: "landing.flows.tables.tab",
    short: "landing.flows.tables.short",
    audience: "landing.flows.tables.audience",
    steps: [
      {
        screen: "tables",
        title: "landing.flows.tables.step1.title",
        body: "landing.flows.tables.step1.body",
      },
      {
        screen: "tableBill",
        title: "landing.flows.tables.step2.title",
        body: "landing.flows.tables.step2.body",
      },
      {
        screen: "split",
        title: "landing.flows.tables.step3.title",
        body: "landing.flows.tables.step3.body",
      },
      {
        screen: "paid",
        title: "landing.flows.tables.step4.title",
        body: "landing.flows.tables.step4.body",
      },
    ],
  },
]

/** The id of a flow's tab, so a link to `#flow-…` scrolls to it and opens it. */
const flowAnchor = (flow: FlowId) => `flow-${flow}`

/** The statistics screen, its figures first and then its charts further down. */
const statsSteps: ReadonlyArray<Step> = [
  {
    screen: "stats",
    title: "landing.stats.overview.title",
    body: "landing.stats.overview.body",
  },
  {
    screen: "statsCharts",
    title: "landing.stats.charts.title",
    body: "landing.stats.charts.body",
  },
]

const mockupAltKeys = {
  bill: "landing.mockup.bill.alt",
  home: "landing.mockup.home.alt",
  items: "landing.mockup.items.alt",
  paid: "landing.mockup.paid.alt",
  payment: "landing.mockup.payment.alt",
  split: "landing.mockup.split.alt",
  stats: "landing.mockup.stats.alt",
  statsCharts: "landing.mockup.statsCharts.alt",
  tableBill: "landing.mockup.tableBill.alt",
  tables: "landing.mockup.tables.alt",
} satisfies Record<MockupScreen, TranslationKey>

const stepNumber = (index: number) => String(index + 1).padStart(2, "0")

function FeatureText({
  step,
  index,
  numbered,
}: {
  readonly step: Step
  readonly index: number
  readonly numbered: boolean
}) {
  const { t } = useLandingTranslation()
  return (
    <div className="flex max-w-lg flex-col gap-4">
      {numbered ? (
        <p className="font-mono text-sm font-semibold text-(--landing-ink)">
          {stepNumber(index)}
        </p>
      ) : null}
      <h3 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {t(step.title)}
      </h3>
      <p className="text-lg leading-relaxed text-pretty text-muted-foreground">
        {t(step.body)}
      </p>
    </div>
  )
}

function PhoneScreen({
  screen,
  className,
}: {
  readonly screen: MockupScreen
  readonly className?: string
}) {
  const { language, t } = useLandingTranslation()
  return (
    <div className={cn("relative", className)}>
      <img
        src={mockupsByLanguage[language][screen]}
        alt={t(mockupAltKeys[screen])}
        width={mockupWidth}
        height={mockupHeight}
        className="w-full drop-shadow-2xl"
        loading="lazy"
      />
      {/* Ripples off the check of the paid screen, the same in every language. */}
      {screen === "paid" ? (
        <div
          aria-hidden="true"
          className="landing-check-ping absolute left-1/2 aspect-square"
          style={{
            top: `${mockupMarks.paidCheck.top}%`,
            width: `${mockupMarks.paidCheck.width}%`,
          }}
        />
      ) : null}
    </div>
  )
}

/** Tracks which step crosses the middle of the viewport. */
function useActiveStep() {
  const steps = useRef<Array<HTMLDivElement | null>>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(steps.current.indexOf(entry.target as HTMLDivElement))
          }
        }
      },
      { rootMargin: "-50% 0px -50% 0px" }
    )
    for (const step of steps.current) {
      if (step !== null) observer.observe(step)
    }
    return () => observer.disconnect()
  }, [])

  return { steps, active }
}

/** Wide screens: the text scrolls past a phone that stays and changes screen. */
function StickyStory({
  steps,
  numbered,
}: {
  readonly steps: ReadonlyArray<Step>
  readonly numbered: boolean
}) {
  const { steps: stepElements, active } = useActiveStep()

  return (
    <div className="grid grid-cols-2 items-start gap-16">
      <div>
        {steps.map((step, index) => (
          <div
            key={step.screen}
            ref={(element) => {
              stepElements.current[index] = element
            }}
            className={cn("landing-step", index === active && "is-active")}
          >
            <FeatureText step={step} index={index} numbered={numbered} />
          </div>
        ))}
      </div>
      <div className="self-stretch">
        <div className="landing-sticky">
          <div className="relative mx-auto flex max-w-sm items-center justify-center gap-6">
            <Glow size="140%" top="50%" left="50%" />
            <div className="relative aspect-[1164/2044] w-full">
              {steps.map((step, index) => (
                <div
                  key={step.screen}
                  className={cn(
                    "landing-screen",
                    index === active && "is-active"
                  )}
                >
                  <PhoneScreen screen={step.screen} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2" aria-hidden="true">
              {steps.map((step, index) => (
                <span
                  key={step.screen}
                  className={cn(
                    "w-1 rounded-full transition-all duration-500",
                    index === active ? "h-10 bg-primary" : "h-4 bg-border"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Narrow screens: each step with its own phone, revealed as it arrives. */
function StackedStory({
  steps,
  numbered,
}: {
  readonly steps: ReadonlyArray<Step>
  readonly numbered: boolean
}) {
  return (
    <div className="flex flex-col gap-20">
      {steps.map((step, index) => (
        <Reveal key={step.screen}>
          <div className="flex flex-col gap-10">
            <FeatureText step={step} index={index} numbered={numbered} />
            <div className="relative mx-auto w-full max-w-xs">
              <Glow size="120%" top="50%" left="50%" />
              <PhoneScreen screen={step.screen} className="relative" />
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

/** Wide screens tell a story with a phone that stays; narrow ones stack it. */
function Story({
  steps,
  wide,
  numbered,
}: {
  readonly steps: ReadonlyArray<Step>
  readonly wide: boolean
  readonly numbered: boolean
}) {
  return wide ? (
    <StickyStory steps={steps} numbered={numbered} />
  ) : (
    <StackedStory steps={steps} numbered={numbered} />
  )
}

/** What the statistics show, whichever way the merchant sells. */
function StatsStory({ wide }: { readonly wide: boolean }) {
  const { t } = useLandingTranslation()
  return (
    <div className="mt-20 rounded-3xl bg-muted/40 px-6 py-10 sm:px-10 lg:mt-28 lg:px-14 lg:pt-14 lg:pb-0">
      <Reveal className="flex max-w-2xl flex-col gap-4">
        <h3 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {t("landing.stats.title")}
        </h3>
        <p className="text-lg leading-relaxed text-pretty text-muted-foreground">
          {t("landing.stats.body")}
        </p>
      </Reveal>
      <div className={wide ? "mt-4" : "mt-12"}>
        <Story steps={statsSteps} wide={wide} numbered={false} />
      </div>
    </div>
  )
}

/**
 * True once `target` has scrolled up past the header, not while it is still
 * below the fold: the compact switcher stands in for the cards only then.
 */
function useScrolledPast(target: RefObject<HTMLElement | null>) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const element = target.current
    if (element === null) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry !== undefined) {
          setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0)
        }
      },
      // Below the sticky header, so cards hidden behind it count as gone.
      { rootMargin: "-64px 0px 0px 0px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [target])
  return past
}

/** A photo card per flow: the tab itself, with whom the flow is for. */
function FlowCard({ flow }: { readonly flow: Flow }) {
  const { t } = useLandingTranslation()
  const Icon = flow.icon
  return (
    <TabsTrigger
      id={flowAnchor(flow.id)}
      value={flow.id}
      className="group/card relative aspect-4/3 h-auto w-[78vw] flex-none max-w-sm shrink-0 snap-center flex-col items-stretch justify-end overflow-hidden rounded-3xl border-0 p-0 text-left whitespace-normal text-white opacity-70 grayscale-[0.6] transition-[opacity,filter,box-shadow] duration-300 after:hidden hover:text-white hover:opacity-100 hover:grayscale-0 data-active:text-white data-active:opacity-100 data-active:shadow-xl data-active:grayscale-0 sm:w-auto sm:max-w-none dark:text-white dark:hover:text-white dark:data-active:text-white scroll-mt-28"
    >
      <img
        src={flow.image}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover/card:scale-105 group-data-active/card:scale-105"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/0"
      />
      <span className="relative flex flex-col gap-1 p-5">
        <span className="mb-2 flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="text-xl font-bold tracking-tight text-balance">
          {t(flow.tab)}
        </span>
        <span className="text-sm leading-snug text-pretty text-white/75">
          {t(flow.audience)}
        </span>
      </span>
    </TabsTrigger>
  )
}

/**
 * The flows again as a small pill that sticks while their story scrolls by,
 * in the header's empty middle on wide screens and just under it on narrow
 * ones, so changing flow never means scrolling back up to the cards.
 */
function CompactSwitcher({
  active,
  visible,
  onSelect,
}: {
  readonly active: FlowId
  readonly visible: boolean
  readonly onSelect: (flow: FlowId) => void
}) {
  const { t } = useLandingTranslation()
  const activeIndex = flows.findIndex((flow) => flow.id === active)
  return (
    // Takes no room: it only overlays the story while stuck.
    <div className="pointer-events-none sticky top-18 z-60 h-0 lg:top-0">
      <div
        inert={!visible}
        className={cn(
          "flex justify-center transition duration-300 lg:h-16 lg:items-center",
          visible ? "opacity-100" : "-translate-y-2 opacity-0"
        )}
      >
        <fieldset
          aria-label={t("landing.flows.label")}
          className="pointer-events-auto relative grid grid-cols-3 rounded-full bg-background/85 p-1 shadow-lg backdrop-blur-md"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-primary transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {flows.map((flow) => {
            const Icon = flow.icon
            return (
              <button
                key={flow.id}
                type="button"
                aria-pressed={flow.id === active}
                onClick={() => onSelect(flow.id)}
                className="relative flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:text-primary-foreground sm:px-5"
              >
                <Icon aria-hidden="true" className="size-4" />
                {t(flow.short)}
              </button>
            )
          })}
        </fieldset>
      </div>
    </div>
  )
}

export function LandingFeatureStory() {
  const { t } = useLandingTranslation()
  // Narrow until hydrated, as the prerendered page is (landing/0002).
  const wide = useMediaQuery("(min-width: 64rem)", {
    initializeWithValue: false,
  })
  // The first flow until hydrated too; a `#flow-…` link then opens its own.
  const [active, setActive] = useState<FlowId>("amount")
  const [hash] = useHash()
  useEffect(() => {
    const linked = flows.find((flow) => hash === `#${flowAnchor(flow.id)}`)
    if (linked !== undefined) setActive(linked.id)
  }, [hash])

  const cards = useRef<HTMLDivElement>(null)
  const story = useRef<HTMLDivElement>(null)
  const cardsGone = useScrolledPast(cards)
  // Narrow, the cards scroll sideways: bring the chosen one into the row.
  useEffect(() => {
    const row = cards.current
    const card = document.getElementById(flowAnchor(active))
    if (row === null || card === null) return
    const offset =
      card.getBoundingClientRect().left - row.getBoundingClientRect().left
    row.scrollTo({
      left: row.scrollLeft + offset - (row.clientWidth - card.clientWidth) / 2,
      behavior: "smooth",
    })
  }, [active])

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal>
        <h2 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          {t("landing.flows.title")}
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          {t("landing.flows.subtitle")}
        </p>
      </Reveal>
      <Tabs
        className="mt-10 flex-col gap-0"
        value={active}
        onValueChange={(value) => {
          const next = flows.find((flow) => flow.id === value)
          if (next !== undefined) setActive(next.id)
        }}
      >
        <TabsList
          ref={cards}
          variant="line"
          aria-label={t("landing.flows.label")}
          // Narrow: a row that scrolls sideways, padded so the ring shows.
          className="-mx-4 flex h-auto w-auto snap-x snap-mandatory items-stretch justify-start gap-4 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0"
        >
          {flows.map((flow) => (
            <FlowCard key={flow.id} flow={flow} />
          ))}
        </TabsList>
        <CompactSwitcher
          active={active}
          visible={cardsGone}
          onSelect={(flow) => {
            setActive(flow)
            // Deep in one story, the next one starts from its first step.
            if ((story.current?.getBoundingClientRect().top ?? 0) < 0) {
              const reduce = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
              ).matches
              story.current?.scrollIntoView({
                behavior: reduce ? "instant" : "smooth",
              })
            }
          }}
        />
        <div ref={story} className="scroll-mt-16 lg:scroll-mt-0">
          {flows.map((flow) => (
            // Every flow stays in the prerendered page, hidden until chosen.
            <TabsContent
              key={flow.id}
              value={flow.id}
              keepMounted
              className="text-base"
            >
              {/* Narrow: room under the stuck switcher after a switch scrolls here. */}
              <div className={wide ? "mt-4" : "mt-20"}>
                <Story steps={flow.steps} wide={wide} numbered />
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
      <StatsStory wide={wide} />
    </section>
  )
}
