import type { TerminalShotName } from "@payky/doc-mockups/terminal-shots"
import {
  CheckIcon,
  ChevronRightIcon,
  CreditCardIcon,
  type LucideIcon,
  XIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { landingTerminalPaths } from "@/core/landing-site.ts"
import {
  Faq,
  type FaqItem,
  LandingShell,
} from "@/features/landing/landing-page.tsx"
import {
  Band,
  bodyClassName,
  Eyebrow,
  SectionHeading,
} from "@/features/landing/landing-parts.tsx"
import { terminalShots } from "@/features/landing/landing-terminal-shots.ts"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import type { Language, TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"

/**
 * One step of a flow: a screen of the app, captured from the app itself
 * (landing/0015), or SwitchioPay's own screen, which only a placeholder can
 * stand for. `labels` are the app's labels the step quotes, in the order
 * they are tapped.
 */
export type ScreenStep =
  | {
      readonly kind: "shot"
      readonly shot: TerminalShotName
      readonly text: TranslationKey
      readonly labels?: ReadonlyArray<TranslationKey>
    }
  | {
      readonly kind: "switchioPay"
      readonly labelKey: TranslationKey
      readonly text: TranslationKey
    }

const activationSteps: ReadonlyArray<ScreenStep> = [
  {
    kind: "shot",
    shot: "settings-payments",
    text: "landing.terminal.activation.step.settings",
    labels: ["nav.settings", "settings.paymentAccounts.title"],
  },
  {
    kind: "shot",
    shot: "payment-methods-off",
    text: "landing.terminal.activation.step.off",
    labels: ["settings.paymentAccounts.method.cardSwitchio"],
  },
  {
    kind: "shot",
    shot: "payment-methods-on",
    text: "landing.terminal.activation.step.on",
    labels: ["settings.paymentAccounts.default"],
  },
  {
    kind: "shot",
    shot: "card-settings",
    text: "landing.terminal.activation.step.card",
    labels: ["settings.cardSwitchioAccount.closureLink"],
  },
]

const paymentSteps: ReadonlyArray<ScreenStep> = [
  {
    kind: "shot",
    shot: "pay-amount",
    text: "landing.terminal.payment.step.amount",
    labels: ["home.pay"],
  },
  {
    kind: "shot",
    shot: "pay-tip",
    text: "landing.terminal.payment.step.tip",
    labels: ["paymentTip.title"],
  },
  {
    kind: "shot",
    shot: "pay-card-tab",
    text: "landing.terminal.payment.step.cardTab",
    labels: ["paymentWait.method.card", "paymentWait.cardPaid.action"],
  },
  {
    kind: "shot",
    shot: "pay-waiting",
    text: "landing.terminal.payment.step.waiting",
    labels: ["paymentWait.cardPaid.pending"],
  },
  {
    kind: "switchioPay",
    labelKey: "landing.terminal.switchioPay.cardTap",
    text: "landing.terminal.payment.step.switchioPay",
  },
  {
    kind: "shot",
    shot: "pay-received",
    text: "landing.terminal.payment.step.received",
    labels: ["paymentWait.paid"],
  },
  {
    kind: "shot",
    shot: "pay-detail",
    text: "landing.terminal.payment.step.detail",
    labels: ["paymentWait.detail"],
  },
]

const reversalSteps: ReadonlyArray<ScreenStep> = [
  {
    kind: "shot",
    shot: "refund-button",
    text: "landing.terminal.reversal.step.button",
    labels: ["nav.activity", "paymentDetail.refunds.action"],
  },
  {
    kind: "shot",
    shot: "refund-reversal",
    text: "landing.terminal.reversal.step.choose",
    labels: ["refund.page.choice.whole", "refund.dialog.method.cardSwitchio"],
  },
  {
    kind: "shot",
    shot: "refund-running",
    text: "landing.terminal.reversal.step.running",
    labels: ["refund.switchio.pending"],
  },
  {
    kind: "switchioPay",
    labelKey: "landing.terminal.switchioPay.reversal",
    text: "landing.terminal.reversal.step.switchioPay",
  },
  {
    kind: "shot",
    shot: "refund-reversed-detail",
    text: "landing.terminal.reversal.step.detail",
    labels: ["refundDetail.card.kind.reversal"],
  },
]

const reversalRules: ReadonlyArray<TranslationKey> = [
  "landing.terminal.reversal.rule.whole",
  "landing.terminal.reversal.rule.first",
  "landing.terminal.reversal.rule.sameTerminal",
  "landing.terminal.reversal.rule.noClosure",
]

const refundSteps: ReadonlyArray<ScreenStep> = [
  {
    kind: "shot",
    shot: "refund-referral",
    text: "landing.terminal.refund.step.referral",
    labels: ["refund.page.choice.whole", "refund.dialog.method.cardSwitchio"],
  },
  {
    kind: "shot",
    shot: "refund-partial",
    text: "landing.terminal.refund.step.partial",
    labels: ["refund.page.choice.part"],
  },
  {
    kind: "shot",
    shot: "refund-tip-only",
    text: "landing.terminal.refund.step.tip",
    labels: ["refund.page.choice.tip"],
  },
  {
    kind: "switchioPay",
    labelKey: "landing.terminal.switchioPay.refund",
    text: "landing.terminal.refund.step.switchioPay",
  },
  {
    kind: "shot",
    shot: "refund-referral-detail",
    text: "landing.terminal.refund.step.detail",
    labels: ["refundDetail.card.kind.referralRefund"],
  },
  {
    kind: "shot",
    shot: "reversal-declined",
    text: "landing.terminal.refund.step.declined",
    labels: ["refund.switchio.reversalDeclined.confirm"],
  },
]

const closureSteps: ReadonlyArray<ScreenStep> = [
  {
    kind: "shot",
    shot: "closure-row",
    text: "landing.terminal.closure.step.row",
    labels: ["nav.settings", "settings.cardClosure.title"],
  },
  {
    kind: "shot",
    shot: "closure-page",
    text: "landing.terminal.closure.step.page",
    labels: ["settings.cardClosure.action"],
  },
  {
    kind: "shot",
    shot: "closure-confirm",
    text: "landing.terminal.closure.step.confirm",
    labels: ["settings.cardClosure.action"],
  },
  {
    kind: "switchioPay",
    labelKey: "landing.terminal.switchioPay.closure",
    text: "landing.terminal.closure.step.switchioPay",
  },
  {
    kind: "shot",
    shot: "closure-detail",
    text: "landing.terminal.closure.step.detail",
    labels: ["settings.cardClosure.result.title"],
  },
]

const closureNotes: ReadonlyArray<TranslationKey> = [
  "landing.terminal.closure.note.perTerminal",
  "landing.terminal.closure.note.outside",
  "landing.terminal.closure.note.reconciliation",
]

type EdgeCaseId =
  | "declined"
  | "canceled"
  | "unknown"
  | "chargeAgain"
  | "busy"
  | "notInstalled"
  | "restored"
  | "otherAccount"
  | "canceledButPaid"
  | "reversalDeclined"
  | "refundUnknown"
  | "refundElsewhere"
  | "closureUnknown"
  | "demo"
  | "offline"

/**
 * A row of the edge cases: its copy is `landing.terminal.edge.<id>.*`,
 * `quote` the app's own message it shows, and `shots` its screens.
 */
interface EdgeCase {
  readonly id: EdgeCaseId
  readonly quote?: TranslationKey
  readonly shots: ReadonlyArray<TerminalShotName>
}

// What the page says here holds only once SwitchioPay is asked about an
// unknown payment and a refused launch records nothing (landing/0015).
const edgeCases: ReadonlyArray<EdgeCase> = [
  {
    id: "declined",
    quote: "paymentWait.cardPaid.error.declined",
    shots: ["edge-declined"],
  },
  { id: "canceled", shots: [] },
  { id: "unknown", shots: ["edge-unknown", "edge-unknown-resolved"] },
  {
    id: "chargeAgain",
    quote: "paymentWait.cardPaid.retryUnresolved.title",
    shots: ["edge-charge-again"],
  },
  { id: "busy", shots: ["edge-busy"] },
  {
    id: "notInstalled",
    quote: "paymentWait.cardPaid.error.unavailable",
    shots: ["edge-not-installed"],
  },
  {
    id: "restored",
    quote: "paymentWait.cardPaid.restored.paid",
    shots: ["edge-restored"],
  },
  { id: "otherAccount", shots: [] },
  {
    id: "canceledButPaid",
    quote: "paymentDetail.collision.title",
    shots: ["edge-canceled-but-paid"],
  },
  {
    id: "reversalDeclined",
    quote: "refund.switchio.reversalDeclined.title",
    shots: ["reversal-declined"],
  },
  {
    id: "refundUnknown",
    quote: "refund.switchio.unresolved",
    shots: ["edge-refund-unknown"],
  },
  {
    id: "refundElsewhere",
    quote: "refund.switchio.pendingElsewhere",
    shots: [],
  },
  {
    id: "closureUnknown",
    quote: "settings.cardClosure.error.unknown",
    shots: ["edge-closure-unknown"],
  },
  {
    id: "demo",
    quote: "paymentWait.cardPaid.error.demo",
    shots: ["edge-demo"],
  },
  { id: "offline", shots: [] },
]

type SimulatorCaseId =
  | "approved"
  | "partial"
  | "duplicate"
  | "insufficientFunds"
  | "expiredCard"
  | "authorizationTimeout"
  | "cardTimeout"
  | "other"

/**
 * The amounts Comgate's simulator answers by, and what the app shows for
 * each: a decline shows the app's own message.
 */
const simulatorCases: ReadonlyArray<{
  readonly id: SimulatorCaseId
  readonly app: TranslationKey | "declined"
}> = [
  { id: "approved", app: "landing.terminal.testing.approved.app" },
  { id: "partial", app: "landing.terminal.testing.partial.app" },
  { id: "duplicate", app: "declined" },
  { id: "insufficientFunds", app: "declined" },
  { id: "expiredCard", app: "declined" },
  { id: "authorizationTimeout", app: "declined" },
  { id: "cardTimeout", app: "declined" },
  { id: "other", app: "landing.terminal.testing.approved.app" },
]

// Checked on the date `landing.terminal.testing.source` names.
export const comgateSimulatorUrl =
  "https://apidoc.comgate.cz/terminaly/simulator"

const limits: ReadonlyArray<TranslationKey> = [
  "landing.terminal.limits.receipts",
  "landing.terminal.limits.operations",
  "landing.terminal.limits.unlinkedRefund",
  "landing.terminal.limits.autoClosure",
  "landing.terminal.limits.reconciliation",
]

/** Also the prerendered page's FAQ structured data (landing/0015). */
export const terminalFaqItems: ReadonlyArray<FaqItem> = [
  {
    question: "landing.terminal.faq.otherTerminal.question",
    answer: "landing.terminal.faq.otherTerminal.answer",
  },
  {
    question: "landing.terminal.faq.forgotClosure.question",
    answer: "landing.terminal.faq.forgotClosure.answer",
  },
  {
    question: "landing.terminal.faq.cardNumber.question",
    answer: "landing.terminal.faq.cardNumber.answer",
  },
  {
    question: "landing.terminal.faq.receipts.question",
    answer: "landing.terminal.faq.receipts.answer",
  },
  {
    question: "landing.terminal.faq.login.question",
    answer: "landing.terminal.faq.login.answer",
  },
]

const flows = [
  activationSteps,
  paymentSteps,
  reversalSteps,
  refundSteps,
  closureSteps,
] as const

/**
 * Every screenshot the page shows, in its steps and its edge cases, which
 * `landing-terminal-shots.test.ts` holds against `terminalShotNames`.
 */
export const terminalPageShots: ReadonlyArray<TerminalShotName> = [
  ...flows.flat().flatMap((step) => (step.kind === "shot" ? [step.shot] : [])),
  ...edgeCases.flatMap((edgeCase) => edgeCase.shots),
]

/** The steps SwitchioPay's own screen stands in for. */
export const terminalSwitchioPaySteps: ReadonlyArray<TranslationKey> = flows
  .flat()
  .flatMap((step) => (step.kind === "switchioPay" ? [step.labelKey] : []))

/** Where the table of contents leads, in the page's order. */
const contents: ReadonlyArray<{
  readonly id: string
  readonly label: TranslationKey
}> = [
  { id: "requirements", label: "landing.terminal.requirements.eyebrow" },
  { id: "activation", label: "landing.terminal.activation.eyebrow" },
  { id: "payment", label: "landing.terminal.payment.eyebrow" },
  { id: "reversal", label: "landing.terminal.reversal.eyebrow" },
  { id: "refund", label: "landing.terminal.refund.eyebrow" },
  { id: "closure", label: "landing.terminal.closure.eyebrow" },
  { id: "edge-cases", label: "landing.terminal.edge.eyebrow" },
  { id: "testing", label: "landing.terminal.testing.eyebrow" },
  { id: "limits", label: "landing.terminal.limits.eyebrow" },
]

// The terminal's display, which every screenshot is captured at.
const shotWidth = 720
const shotHeight = 1600

const screenClassName = "w-full max-w-60 rounded-[1.75rem]"

/** One screenshot, or nothing while it has not been generated yet. */
function ShotImage({
  shot,
  className,
}: {
  readonly shot: TerminalShotName
  readonly className?: string
}) {
  const { language, t } = useLandingTranslation()
  const src = terminalShots[language][shot]
  if (src === undefined) return null
  return (
    <img
      src={src}
      alt={t(`landing.terminal.shot.${shot}.alt`)}
      width={shotWidth}
      height={shotHeight}
      loading="lazy"
      decoding="async"
      className={cn("h-auto shadow-md", className)}
    />
  )
}

/**
 * Stands in for SwitchioPay's own screen, which cannot be captured from the
 * app (landing/0015): the terminal's shape, a neutral surface, a card and
 * what happens there, in HTML so it is translated, read by screen readers
 * and drawn in the page's light or dark theme.
 */
export function SwitchioPayPlaceholder({
  labelKey,
}: {
  readonly labelKey: TranslationKey
}) {
  const { t } = useLandingTranslation()
  return (
    <figure
      data-switchio-pay-placeholder=""
      className={cn(
        screenClassName,
        "flex aspect-[720/1600] flex-col items-center justify-center gap-5 bg-muted p-6 text-center text-muted-foreground shadow-inner"
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-background/70">
        <CreditCardIcon aria-hidden="true" className="size-8" />
      </span>
      <figcaption className="flex flex-col gap-1">
        <span className="font-mono text-xs font-semibold tracking-[0.12em] uppercase">
          {t("landing.terminal.switchioPay.name")}
        </span>
        <span className="text-lg font-semibold text-balance text-foreground">
          {t(labelKey)}
        </span>
      </figcaption>
    </figure>
  )
}

/** The app's labels a step quotes, as the path through them. */
function Labels({
  labels,
}: {
  readonly labels: ReadonlyArray<TranslationKey>
}) {
  const { t } = useLandingTranslation()
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      {labels.map((label, index) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          {index === 0 ? null : (
            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          )}
          <span className="rounded-md bg-accent px-2 py-0.5 font-semibold">
            {t(label)}
          </span>
        </span>
      ))}
    </p>
  )
}

/**
 * A flow step by step: the number, what to do and the screen it shows,
 * stacked on a phone and two to a row on a wider screen.
 */
export function ScreenshotSteps({
  steps,
}: {
  readonly steps: ReadonlyArray<ScreenStep>
}) {
  const { t } = useLandingTranslation()
  return (
    <ol className="mt-12 grid gap-6 md:grid-cols-2">
      {steps.map((step, index) => (
        <li
          key={step.text}
          className="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm"
        >
          <div className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground"
            >
              {index + 1}
            </span>
            <div className="flex flex-col gap-3 pt-1">
              <p className="leading-relaxed text-pretty">{t(step.text)}</p>
              {step.kind === "shot" && step.labels !== undefined ? (
                <Labels labels={step.labels} />
              ) : null}
            </div>
          </div>
          <div className="mt-auto flex justify-center">
            {step.kind === "shot" ? (
              <ShotImage shot={step.shot} className={screenClassName} />
            ) : (
              <SwitchioPayPlaceholder labelKey={step.labelKey} />
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function IconList({
  items,
  icon: Icon,
}: {
  readonly items: ReadonlyArray<TranslationKey>
  readonly icon: LucideIcon
}) {
  const { t } = useLandingTranslation()
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-relaxed text-pretty">
          <Icon
            aria-hidden="true"
            className="mt-1 size-4 shrink-0 text-(--landing-ink)"
          />
          <span>{t(item)}</span>
        </li>
      ))}
    </ul>
  )
}

function Hero() {
  const { t } = useLandingTranslation()
  return (
    <section className="landing-dots relative isolate overflow-hidden">
      <div className="mx-auto flex max-w-4xl flex-col gap-7 px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-24 lg:pb-24">
        <Eyebrow>{t("landing.terminal.hero.eyebrow")}</Eyebrow>
        <h1 className="text-5xl font-extrabold tracking-tight text-balance sm:text-6xl">
          {t("landing.terminal.hero.title")}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
          {t("landing.terminal.hero.body")}
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
          {t("landing.terminal.hero.note")}
        </p>
        <nav aria-label={t("landing.terminal.toc.title")}>
          <ol className="flex flex-wrap gap-2">
            {contents.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="inline-flex rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-accent"
                >
                  {t(item.label)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  )
}

const permissions: ReadonlyArray<{
  readonly action: TranslationKey
  readonly permission: TranslationKey
}> = [
  {
    action: "landing.terminal.requirements.permissions.activation",
    permission: "access.permission.admin",
  },
  {
    action: "landing.terminal.requirements.permissions.refund",
    permission: "access.permission.refund",
  },
  {
    action: "landing.terminal.requirements.permissions.closure",
    permission: "access.permission.confirm",
  },
]

function Requirements() {
  const { t } = useLandingTranslation()
  return (
    <Band id="requirements" muted>
      <SectionHeading
        eyebrow="landing.terminal.requirements.eyebrow"
        title="landing.terminal.requirements.title"
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm">
          <IconList
            icon={CheckIcon}
            items={[
              "landing.terminal.requirements.terminal",
              "landing.terminal.requirements.install",
              "landing.terminal.requirements.onboarding",
            ]}
          />
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold tracking-tight">
              {t("landing.terminal.requirements.permissions.title")}
            </h3>
            <p className="leading-relaxed text-pretty text-muted-foreground">
              {t("landing.terminal.requirements.permissions.body")}
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
              {permissions.map((item) => (
                <div key={item.action} className="contents">
                  <dt>{t(item.action)}</dt>
                  <dd className="text-right">
                    <span className="rounded-md bg-accent px-2 py-0.5 text-sm font-semibold">
                      {t(item.permission)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="landing-beam flex flex-col gap-3 rounded-2xl p-6 shadow-sm">
          <h3 className="text-xl font-semibold tracking-tight">
            {t("landing.terminal.requirements.tester.title")}
          </h3>
          <p className={bodyClassName}>
            {t("landing.terminal.requirements.tester.body")}
          </p>
        </div>
      </div>
    </Band>
  )
}

function FlowSection({
  id,
  muted = false,
  name,
  steps,
  before,
  after,
}: {
  readonly id: string
  readonly muted?: boolean
  readonly name: "activation" | "payment" | "reversal" | "refund" | "closure"
  readonly steps: ReadonlyArray<ScreenStep>
  /** What the section says between its heading and its steps. */
  readonly before?: ReactNode
  /** What it adds below its steps. */
  readonly after?: ReactNode
}) {
  return (
    <Band id={id} muted={muted}>
      <SectionHeading
        eyebrow={`landing.terminal.${name}.eyebrow`}
        title={`landing.terminal.${name}.title`}
        body={`landing.terminal.${name}.body`}
      />
      {before === undefined ? null : (
        <div className="mt-8 max-w-3xl">{before}</div>
      )}
      <ScreenshotSteps steps={steps} />
      {after === undefined ? null : (
        <div className="mt-10 max-w-3xl">{after}</div>
      )}
    </Band>
  )
}

function Note({ text }: { readonly text: TranslationKey }) {
  const { t } = useLandingTranslation()
  return (
    <p className="leading-relaxed text-pretty text-muted-foreground">
      {t(text)}
    </p>
  )
}

const cellClassName =
  "px-5 py-4 align-top md:bg-card before:block before:font-mono before:text-xs before:font-semibold before:tracking-[0.08em] before:text-muted-foreground before:uppercase before:content-[attr(data-label)] max-md:py-2 md:before:hidden"

/** The app's own words, quoted. */
function Quote({ text }: { readonly text: TranslationKey }) {
  const { t } = useLandingTranslation()
  return <q className="mt-1 block font-semibold">{t(text)}</q>
}

/**
 * What happens when something goes differently, row by row. On a phone each
 * row turns into a card with its own column labels, as the comparison on
 * the page on how the app works does.
 */
function EdgeCases() {
  const { t } = useLandingTranslation()
  const columns = {
    see: t("landing.terminal.edge.column.see"),
    do: t("landing.terminal.edge.column.do"),
    records: t("landing.terminal.edge.column.records"),
  }
  return (
    <Band id="edge-cases" muted>
      <SectionHeading
        eyebrow="landing.terminal.edge.eyebrow"
        title="landing.terminal.edge.title"
        body="landing.terminal.edge.body"
      />
      <table className="mt-12 w-full border-separate border-spacing-y-2 text-left max-md:block">
        <thead className="max-md:sr-only">
          <tr>
            {(
              [
                "landing.terminal.edge.column.situation",
                "landing.terminal.edge.column.see",
                "landing.terminal.edge.column.do",
                "landing.terminal.edge.column.records",
              ] as const
            ).map((column) => (
              <th
                key={column}
                scope="col"
                className="px-5 pb-2 text-sm font-semibold text-muted-foreground"
              >
                {t(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:flex max-md:flex-col max-md:gap-4">
          {edgeCases.map((edgeCase) => (
            <tr
              key={edgeCase.id}
              className="max-md:flex max-md:flex-col max-md:overflow-hidden max-md:rounded-2xl max-md:bg-card max-md:pb-2 max-md:shadow-sm"
            >
              <th
                scope="row"
                className="px-5 py-4 align-top font-semibold text-pretty md:w-1/4 md:rounded-l-2xl md:bg-card max-md:pb-2"
              >
                {t(`landing.terminal.edge.${edgeCase.id}.situation`)}
              </th>
              <td data-label={columns.see} className={cellClassName}>
                <span className="text-pretty">
                  {t(`landing.terminal.edge.${edgeCase.id}.see`)}
                </span>
                {edgeCase.quote === undefined ? null : (
                  <Quote text={edgeCase.quote} />
                )}
                {edgeCase.shots.length === 0 ? null : (
                  <span className="mt-3 flex gap-2">
                    {edgeCase.shots.map((shot) => (
                      <ShotImage
                        key={shot}
                        shot={shot}
                        className="w-24 rounded-lg"
                      />
                    ))}
                  </span>
                )}
              </td>
              <td
                data-label={columns.do}
                className={cn(cellClassName, "text-pretty")}
              >
                {t(`landing.terminal.edge.${edgeCase.id}.do`)}
              </td>
              <td
                data-label={columns.records}
                className={cn(cellClassName, "text-pretty md:rounded-r-2xl")}
              >
                {t(`landing.terminal.edge.${edgeCase.id}.records`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Band>
  )
}

function Testing() {
  const { t } = useLandingTranslation()
  const columns = {
    simulator: t("landing.terminal.testing.column.simulator"),
    app: t("landing.terminal.testing.column.app"),
  }
  return (
    <Band id="testing">
      <SectionHeading
        eyebrow="landing.terminal.testing.eyebrow"
        title="landing.terminal.testing.title"
        body="landing.terminal.testing.body"
      />
      <table className="mt-12 w-full border-separate border-spacing-y-2 text-left max-md:block">
        <thead className="max-md:sr-only">
          <tr>
            {(
              [
                "landing.terminal.testing.column.amount",
                "landing.terminal.testing.column.simulator",
                "landing.terminal.testing.column.app",
              ] as const
            ).map((column) => (
              <th
                key={column}
                scope="col"
                className="px-5 pb-2 text-sm font-semibold text-muted-foreground"
              >
                {t(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:flex max-md:flex-col max-md:gap-4">
          {simulatorCases.map((row) => (
            <tr
              key={row.id}
              className="max-md:flex max-md:flex-col max-md:overflow-hidden max-md:rounded-2xl max-md:bg-card max-md:pb-2 max-md:shadow-sm"
            >
              <th
                scope="row"
                className="px-5 py-4 align-top font-mono font-semibold whitespace-nowrap md:rounded-l-2xl md:bg-card max-md:pb-2"
              >
                {t(`landing.terminal.testing.${row.id}.amount`)}
              </th>
              <td data-label={columns.simulator} className={cellClassName}>
                {t(`landing.terminal.testing.${row.id}.simulator`)}
              </td>
              <td
                data-label={columns.app}
                className={cn(cellClassName, "text-pretty md:rounded-r-2xl")}
              >
                {row.app === "declined" ? (
                  <>
                    <Quote text="paymentWait.cardPaid.error.declined" />
                    <span className="mt-1 block text-muted-foreground">
                      {t("landing.terminal.testing.declined")}
                    </span>
                  </>
                ) : (
                  t(row.app)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 max-w-3xl">
        <Note text="landing.terminal.testing.operations" />
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-pretty text-muted-foreground">
        {t("landing.terminal.testing.source")}{" "}
        <a
          className="font-semibold hover:underline"
          href={comgateSimulatorUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("landing.terminal.testing.sourceLink")}
        </a>
      </p>
    </Band>
  )
}

function Limits() {
  return (
    <Band id="limits" muted>
      <SectionHeading
        eyebrow="landing.terminal.limits.eyebrow"
        title="landing.terminal.limits.title"
      />
      <div className="mt-12 max-w-3xl rounded-2xl bg-card p-6 shadow-sm">
        <IconList icon={XIcon} items={limits} />
      </div>
    </Band>
  )
}

/**
 * The card terminal documentation, Finito's alone (landing/0015): how to
 * turn card payments on and run each operation SwitchioPay integrates, step
 * by step with the app's own screens, then what goes differently, how to
 * test it with Comgate and what the app does not do. Bands alternate muted
 * and plain, starting muted below the hero.
 */
export function LandingTerminalPage({
  language,
}: {
  readonly language: Language
}) {
  if (landingTerminalPaths === undefined) {
    throw new Error("Only Finito's landing documents the card terminal.")
  }
  return (
    <LandingShell language={language} paths={landingTerminalPaths}>
      <Hero />
      <Requirements />
      <FlowSection id="activation" name="activation" steps={activationSteps} />
      <FlowSection
        id="payment"
        name="payment"
        steps={paymentSteps}
        muted
        after={<Note text="landing.terminal.payment.note" />}
      />
      <FlowSection
        id="reversal"
        name="reversal"
        steps={reversalSteps}
        before={<IconList icon={CheckIcon} items={reversalRules} />}
      />
      <FlowSection id="refund" name="refund" steps={refundSteps} muted />
      <FlowSection
        id="closure"
        name="closure"
        steps={closureSteps}
        after={<IconList icon={CheckIcon} items={closureNotes} />}
      />
      <EdgeCases />
      <Testing />
      <Limits />
      <Faq items={terminalFaqItems} muted={false} />
    </LandingShell>
  )
}
