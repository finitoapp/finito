import {
  BanknoteIcon,
  BriefcaseBusinessIcon,
  CreditCardIcon,
  DatabaseIcon,
  HatGlassesIcon,
  HeadsetIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LockIcon,
  type LucideIcon,
  ReceiptTextIcon,
  ServerIcon,
  SmartphoneIcon,
  StoreIcon,
  WalletIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react"
import { Fragment, type ReactNode } from "react"

import {
  type Point,
  Pulse,
  percent,
  Reveal,
} from "@/features/landing/landing-parts.tsx"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import type { TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"

/**
 * The diagrams of the page on what makes Payky different (landing/0008), in
 * the visual language of the home page's hero: round nodes, dashed lines and
 * sparks of light travelling along them. Labels stay HTML, so they are
 * translated, prerendered and read like the rest of the page; only the lines
 * are SVG.
 */

/** Who a participant is: who receives the money, who stands in the way, who is absent. */
type NodeTone = "plain" | "money" | "risk" | "ghost"

/** What travels along a line: money, a detour through a provider, the app's own messages, or plain traffic. */
type LinkTone = "plain" | "money" | "risk" | "talk"

interface StageNode {
  readonly id: string
  readonly icon: LucideIcon
  readonly label?: TranslationKey
  readonly note?: TranslationKey
  readonly tone?: NodeTone
  readonly small?: boolean
  /** Percent position on a wide stage. */
  readonly at: Point
  /** Percent position on a narrow stage; the wide one with its axes swapped if left out. */
  readonly narrow?: Point
}

interface StageLink {
  readonly from: string
  readonly to: string
  readonly tone?: LinkTone
  /** What travels along the line, if anything: a spark, a padlock or a readable receipt. */
  readonly pulse?: "spark" | "lock" | "receipt"
  /** Drawn from the far end only halfway: a connection that never arrives. */
  readonly cut?: boolean
  /** The apex of an arc on a wide stage, for a line that leaps over what lies between its ends. */
  readonly via?: Point
}

interface StageText {
  readonly text: TranslationKey
  readonly at: Point
  readonly narrow?: Point
}

interface StageLayout {
  readonly nodes: ReadonlyArray<StageNode>
  readonly links: ReadonlyArray<StageLink>
  readonly texts?: ReadonlyArray<StageText>
  /** Sparks run one segment after another, in link order, as one journey from end to end. */
  readonly chained?: boolean
  /** CSS aspect ratios of the stage on a wide and on a narrow screen. */
  readonly wideRatio: string
  readonly narrowRatio: string
}

// A segment's spark lasts as long as the next one waits, so each leaves a
// node just as the one before arrives.
const chainedPulseSeconds = 1.6

const positionOf = (
  item: { readonly at: Point; readonly narrow?: Point },
  wide: boolean
): Point => (wide ? item.at : (item.narrow ?? { x: item.at.y, y: item.at.x }))

const nodeToneClassNames = {
  plain: "bg-card text-(--landing-ink) shadow-md",
  money:
    "bg-primary text-primary-foreground shadow-[0_0_28px_6px] shadow-primary/45",
  risk: "bg-destructive/12 text-destructive shadow-[0_0_28px_6px] shadow-destructive/25",
  ghost: "bg-muted-foreground/12 text-muted-foreground",
} satisfies Record<NodeTone, string>

const linkToneProps = {
  plain: { className: "stroke-border", strokeWidth: 1.5, dash: "2 6" },
  money: { className: "stroke-primary", strokeWidth: 2.5, dash: undefined },
  risk: { className: "stroke-destructive/70", strokeWidth: 2, dash: "5 5" },
  talk: { className: "stroke-(--landing-ink)", strokeWidth: 1.5, dash: "4 4" },
} satisfies Record<
  LinkTone,
  {
    readonly className: string
    readonly strokeWidth: number
    readonly dash: string | undefined
  }
>

function StageNodeView({
  node,
  position,
}: {
  readonly node: StageNode
  readonly position: Point
}) {
  const { t } = useLandingTranslation()
  const Icon = node.icon
  return (
    <div
      className="landing-node z-10"
      style={{ left: percent(position.x), top: percent(position.y) }}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full",
          node.small ? "size-8" : "size-12 md:size-14",
          nodeToneClassNames[node.tone ?? "plain"]
        )}
      >
        <Icon
          aria-hidden="true"
          className={node.small ? "size-4" : "size-5 md:size-6"}
        />
      </span>
      {/* A chip of its own, so a line running on below the node passes behind it. */}
      {node.label === undefined ? null : (
        <span className="absolute top-full left-1/2 mt-2 w-max max-w-[6.5rem] -translate-x-1/2 rounded-lg bg-card/95 px-2 py-0.5 text-center text-xs leading-snug font-semibold text-pretty shadow-sm md:max-w-[9rem] md:text-sm">
          {t(node.label)}
          {node.note === undefined ? null : (
            <span className="block font-normal text-muted-foreground">
              {t(node.note)}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

function StageView({
  stage,
  wide,
  className,
}: {
  readonly stage: StageLayout
  readonly wide: boolean
  readonly className?: string
}) {
  const { t } = useLandingTranslation()
  const nodesById = new Map(stage.nodes.map((node) => [node.id, node]))
  const lines = stage.links.flatMap((link) => {
    const from = nodesById.get(link.from)
    const to = nodesById.get(link.to)
    return from === undefined || to === undefined
      ? []
      : [
          {
            link,
            from: positionOf(from, wide),
            to: positionOf(to, wide),
            via:
              link.via === undefined
                ? undefined
                : positionOf({ at: link.via }, wide),
          },
        ]
  })

  return (
    <div
      className={cn("relative", className)}
      style={{ aspectRatio: wide ? stage.wideRatio : stage.narrowRatio }}
    >
      <svg
        className="landing-network"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {lines.map(({ link, from, to, via }) => {
          const tone = linkToneProps[link.tone ?? "plain"]
          // The control point that puts the curve's midpoint on the apex.
          const control =
            via === undefined
              ? from
              : {
                  x: 2 * via.x - (from.x + to.x) / 2,
                  y: 2 * via.y - (from.y + to.y) / 2,
                }
          const along = (share: number) =>
            `${from.x + (to.x - from.x) * share} ${from.y + (to.y - from.y) * share}`
          const d =
            via !== undefined
              ? `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`
              : link.cut === true
                ? `M ${along(0.55)} L ${along(1)}`
                : `M ${along(0)} L ${along(1)}`
          return (
            <path
              key={`${link.from}-${link.to}`}
              d={d}
              fill="none"
              className={tone.className}
              strokeWidth={tone.strokeWidth}
              strokeDasharray={tone.dash}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      {lines.map(({ link, from, to, via }, index) =>
        link.pulse === undefined ? null : (
          <Pulse
            key={`${link.from}-${link.to}`}
            from={from}
            to={to}
            via={via}
            delay={index * (stage.chained === true ? chainedPulseSeconds : 0.7)}
            duration={stage.chained === true ? chainedPulseSeconds : undefined}
            className={cn(
              link.tone === "risk" && "landing-pulse-risk",
              link.tone === "talk" && "landing-pulse-talk",
              link.pulse !== "spark" && "landing-pulse-icon"
            )}
          >
            {link.pulse === "lock" ? (
              <LockIcon className="size-3.5" strokeWidth={2.5} />
            ) : link.pulse === "receipt" ? (
              <ReceiptTextIcon className="size-3.5" strokeWidth={2.5} />
            ) : null}
          </Pulse>
        )
      )}
      {stage.texts?.map((text) => {
        const position = positionOf(text, wide)
        return (
          <p
            key={text.text}
            className="landing-node w-max max-w-[6.5rem] text-center font-mono text-[0.7rem] leading-snug font-semibold tracking-[0.08em] text-(--landing-ink) uppercase md:max-w-[10rem]"
            style={{ left: percent(position.x), top: percent(position.y) }}
          >
            {t(text.text)}
          </p>
        )
      })}
      {stage.nodes.map((node) => (
        <StageNodeView
          key={node.id}
          node={node}
          position={positionOf(node, wide)}
        />
      ))}
    </div>
  )
}

/**
 * A stage laid out across on a wide screen and top to bottom on a narrow
 * one; only one of the two is displayed, so only one is read.
 */
function Stage({ stage }: { readonly stage: StageLayout }) {
  return (
    // Room below for the labels of the last row of nodes.
    <div className="pb-14">
      <StageView stage={stage} wide className="hidden md:block" />
      <StageView stage={stage} wide={false} className="md:hidden" />
    </div>
  )
}

interface CompareStep {
  readonly id: string
  readonly icon: LucideIcon
  readonly label: TranslationKey
  /** Percent along the lane. */
  readonly x: number
  readonly tone?: NodeTone
}

const compareSteps: ReadonlyArray<CompareStep> = [
  {
    id: "bank",
    icon: LandmarkIcon,
    label: "landing.tech.node.customerPayment",
    x: 8,
  },
  {
    id: "account",
    icon: BanknoteIcon,
    label: "landing.tech.node.account",
    x: 36,
    tone: "money",
  },
  {
    id: "operator",
    icon: ServerIcon,
    label: "landing.tech.node.operator",
    x: 64,
  },
  { id: "app", icon: SmartphoneIcon, label: "landing.tech.node.app", x: 92 },
]

// Low in the lane, leaving the room above for the arc.
const laneY = 66

// The money runs the same way in both lanes; only the app's road differs.
const moneyLinks: ReadonlyArray<StageLink> = [
  { from: "bank", to: "account", tone: "money", pulse: "spark" },
]

const compareLane = (
  operatorTone: NodeTone,
  appLinks: ReadonlyArray<StageLink>
): StageLayout => ({
  // A fixed height instead, so the arc keeps its leap on any width.
  wideRatio: "auto",
  narrowRatio: "1 / 3.2",
  chained: true,
  nodes: compareSteps.map((step) => ({
    id: step.id,
    icon: step.icon,
    small: true,
    tone: step.id === "operator" ? operatorTone : step.tone,
    at: { x: step.x, y: laneY },
  })),
  links: [...moneyLinks, ...appLinks],
})

// The same road twice, read left to right as the news of a payment travels:
// to the cloud app through its provider's server, to Payky over its head.
const compareLanes = [
  {
    id: "cloud",
    title: "landing.tech.compare.cloudFlow.title",
    caption: "landing.tech.compare.cloudFlow.caption",
    titleClassName: "text-destructive",
    stage: compareLane("risk", [
      { from: "account", to: "operator", tone: "risk", pulse: "spark" },
      { from: "operator", to: "app", tone: "risk", pulse: "spark" },
    ]),
  },
  {
    id: "payky",
    title: "landing.tech.compare.paykyFlow.title",
    caption: "landing.tech.compare.paykyFlow.caption",
    titleClassName: "text-(--landing-ink)",
    stage: compareLane("ghost", [
      {
        from: "account",
        to: "app",
        tone: "talk",
        pulse: "spark",
        via: { x: 64, y: 10 },
      },
    ]),
  },
] as const satisfies ReadonlyArray<{
  readonly id: string
  readonly title: TranslationKey
  readonly caption: TranslationKey
  readonly titleClassName: string
  readonly stage: StageLayout
}>

/**
 * The logo as a watermark in the corner of a Payky box, cut off by its edge;
 * the box must be `relative isolate overflow-hidden`.
 */
function PaykyWatermark() {
  return (
    <img
      src="/landing/pwa-icon.svg"
      alt=""
      className="pointer-events-none absolute -right-12 -bottom-16 -z-10 size-56 -rotate-12 opacity-10 select-none dark:opacity-[0.07]"
    />
  )
}

/** What the two kinds of line mean. */
function CompareLegend({ className }: { readonly className?: string }) {
  const { t } = useLandingTranslation()
  return (
    <ul
      className={cn(
        "flex flex-col gap-1 text-xs leading-snug text-muted-foreground",
        className
      )}
    >
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-1 w-6 shrink-0 rounded-full bg-primary"
        />
        {t("landing.tech.compare.legend.money")}
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-0.5 w-6 shrink-0 rounded-full bg-(--landing-ink)"
        />
        {t("landing.tech.compare.legend.talk")}
      </li>
    </ul>
  )
}

const stepLabelClassName =
  "absolute w-max text-xs leading-snug font-semibold text-pretty text-muted-foreground"

/**
 * The two lanes under one row of step labels on a wide screen; on a narrow
 * one, two columns beside one column of labels.
 */
function CompareLanes({ wide }: { readonly wide: boolean }) {
  const { t } = useLandingTranslation()
  if (wide) {
    return (
      <div className="hidden grid-cols-[8rem_minmax(0,1fr)] gap-x-6 gap-y-1 md:grid">
        <CompareLegend className="self-end" />
        <div className="relative h-10">
          {compareSteps.map((step) => (
            <span
              key={step.id}
              className={cn(
                stepLabelClassName,
                "bottom-0 max-w-[8rem] -translate-x-1/2 text-center md:text-sm"
              )}
              style={{ left: percent(step.x) }}
            >
              {t(step.label)}
            </span>
          ))}
        </div>
        {compareLanes.map((lane) => (
          <Fragment key={lane.id}>
            <div className="relative">
              <p
                className={cn(
                  "absolute inset-x-0 -translate-y-1/2 font-semibold text-pretty",
                  lane.titleClassName
                )}
                style={{ top: percent(laneY) }}
              >
                {t(lane.title)}
              </p>
            </div>
            <StageView stage={lane.stage} wide className="h-24" />
          </Fragment>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-x-3 gap-y-3 md:hidden">
      <CompareLegend className="self-end" />
      {compareLanes.map((lane) => (
        <p
          key={lane.id}
          className={cn(
            "self-end text-center text-xs leading-snug font-semibold text-pretty",
            lane.titleClassName
          )}
        >
          {t(lane.title)}
        </p>
      ))}
      <div className="relative">
        {compareSteps.map((step) => (
          <span
            key={step.id}
            className={cn(
              stepLabelClassName,
              "right-0 max-w-full -translate-y-1/2 text-right"
            )}
            style={{ top: percent(step.x) }}
          >
            {t(step.label)}
          </span>
        ))}
      </div>
      {compareLanes.map((lane) => (
        <StageView key={lane.id} stage={lane.stage} wide={false} />
      ))}
    </div>
  )
}

/**
 * One payment, two roads for the app: round through the provider's server
 * with a typical cloud app, over its head straight to the bank with Payky.
 */
export function CompareDiagram() {
  const { t } = useLandingTranslation()
  return (
    <Reveal className="relative isolate mt-12 overflow-hidden rounded-3xl bg-card p-6 shadow-sm sm:p-8">
      <PaykyWatermark />
      <CompareLanes wide />
      <CompareLanes wide={false} />
      <div className="mt-6 grid gap-4 text-sm leading-relaxed text-pretty text-muted-foreground md:grid-cols-2">
        {compareLanes.map((lane) => (
          <p key={lane.id}>
            <span className={cn("block font-semibold", lane.titleClassName)}>
              {t(lane.title)}
            </span>
            {t(lane.caption)}
          </p>
        ))}
      </div>
    </Reveal>
  )
}

// Lanes across a wide stage, columns down a narrow one.
const lanes = { qr: 14, lightning: 44, card: 74 } as const
const columns = { qr: 17, lightning: 50, card: 83 } as const

const moneyStage: StageLayout = {
  wideRatio: "16 / 9",
  narrowRatio: "1 / 2",
  texts: [
    {
      text: "landing.tech.money.qr.title",
      at: { x: 8, y: lanes.qr - 12 },
      narrow: { x: columns.qr, y: 3 },
    },
    {
      text: "landing.tech.money.lightning.title",
      at: { x: 8, y: lanes.lightning - 12 },
      narrow: { x: columns.lightning, y: 3 },
    },
    {
      text: "landing.tech.money.card.title",
      at: { x: 8, y: lanes.card - 12 },
      narrow: { x: columns.card, y: 3 },
    },
  ],
  nodes: [
    {
      id: "qr-from",
      icon: LandmarkIcon,
      label: "landing.tech.node.customerBank",
      at: { x: 8, y: lanes.qr },
      narrow: { x: columns.qr, y: 14 },
    },
    {
      id: "qr-to",
      icon: BanknoteIcon,
      label: "landing.tech.node.account",
      tone: "money",
      at: { x: 92, y: lanes.qr },
      narrow: { x: columns.qr, y: 78 },
    },
    {
      id: "lightning-from",
      icon: WalletIcon,
      label: "landing.tech.node.customerWallet",
      at: { x: 8, y: lanes.lightning },
      narrow: { x: columns.lightning, y: 14 },
    },
    {
      id: "lightning-via",
      icon: ZapIcon,
      label: "landing.tech.node.spark",
      at: { x: 50, y: lanes.lightning },
      narrow: { x: columns.lightning, y: 46 },
    },
    {
      id: "lightning-to",
      icon: WalletIcon,
      label: "landing.tech.node.wallet",
      tone: "money",
      at: { x: 92, y: lanes.lightning },
      narrow: { x: columns.lightning, y: 78 },
    },
    {
      id: "card-from",
      icon: CreditCardIcon,
      label: "landing.tech.node.card",
      at: { x: 8, y: lanes.card },
      narrow: { x: columns.card, y: 14 },
    },
    {
      id: "card-via",
      icon: LandmarkIcon,
      label: "landing.tech.node.switchio",
      at: { x: 50, y: lanes.card },
      narrow: { x: columns.card, y: 46 },
    },
    {
      id: "card-to",
      icon: BanknoteIcon,
      label: "landing.tech.node.account",
      tone: "money",
      at: { x: 92, y: lanes.card },
      narrow: { x: columns.card, y: 78 },
    },
    {
      // Off every route on purpose: the point of the diagram.
      id: "payky",
      icon: SmartphoneIcon,
      label: "landing.tech.node.payky",
      note: "landing.tech.node.outside",
      tone: "ghost",
      at: { x: 50, y: 96 },
      narrow: { x: 50, y: 94 },
    },
  ],
  links: [
    { from: "qr-from", to: "qr-to", tone: "money", pulse: "spark" },
    {
      from: "lightning-from",
      to: "lightning-via",
      tone: "money",
      pulse: "spark",
    },
    {
      from: "lightning-via",
      to: "lightning-to",
      tone: "money",
      pulse: "spark",
    },
    { from: "card-from", to: "card-via", tone: "money", pulse: "spark" },
    { from: "card-via", to: "card-to", tone: "money", pulse: "spark" },
  ],
}

/** The three ways money comes in, each a route Payky is not on. */
export function MoneyDiagram() {
  return (
    <Reveal className="mt-12 rounded-3xl bg-card p-6 shadow-sm sm:p-10">
      <Stage stage={moneyStage} />
    </Reveal>
  )
}

const backupSteps: ReadonlyArray<CompareStep> = [
  { id: "phone", icon: SmartphoneIcon, label: "landing.tech.node.phone", x: 8 },
  {
    id: "server",
    icon: ServerIcon,
    label: "landing.tech.node.serverOrRelay",
    x: 50,
  },
  {
    id: "device",
    icon: SmartphoneIcon,
    label: "landing.tech.node.otherDevice",
    x: 92,
  },
]

// The people who could reach a server's data, in a row above it.
const backupPeople = [
  {
    id: "support",
    icon: HeadsetIcon,
    label: "landing.tech.backup.people.support",
    x: 26,
  },
  {
    id: "engineers",
    icon: WrenchIcon,
    label: "landing.tech.backup.people.engineers",
    x: 42,
  },
  {
    id: "sales",
    icon: BriefcaseBusinessIcon,
    label: "landing.tech.backup.people.sales",
    x: 58,
  },
  {
    id: "attacker",
    icon: HatGlassesIcon,
    label: "landing.tech.backup.people.attacker",
    x: 74,
  },
] as const satisfies ReadonlyArray<{
  readonly id: string
  readonly icon: LucideIcon
  readonly label: TranslationKey
  readonly x: number
}>

const backupLaneY = 78

const backupLane = (readable: boolean): StageLayout => ({
  wideRatio: "auto",
  narrowRatio: "auto",
  chained: true,
  nodes: [
    ...backupSteps.map(
      (step): StageNode => ({
        id: step.id,
        icon: step.icon,
        small: true,
        tone: step.id === "server" ? (readable ? "risk" : "ghost") : step.tone,
        at: { x: step.x, y: backupLaneY },
      })
    ),
    ...backupPeople.map(
      (person): StageNode => ({
        id: person.id,
        icon: person.icon,
        small: true,
        tone: readable ? "plain" : "ghost",
        at: { x: person.x, y: 16 },
      })
    ),
  ],
  links: [
    readable
      ? { from: "phone", to: "server", tone: "risk", pulse: "receipt" }
      : { from: "phone", to: "server", pulse: "lock" },
    readable
      ? { from: "server", to: "device", tone: "risk", pulse: "receipt" }
      : { from: "server", to: "device", pulse: "lock" },
    ...backupPeople.map(
      (person): StageLink =>
        readable
          ? { from: "server", to: person.id, tone: "risk", pulse: "spark" }
          : { from: "server", to: person.id, cut: true }
    ),
  ],
})

// The same road twice: the cloud app's server reads what it carries and so
// can anyone who reaches it; a relay carries noise nobody can read.
const backupLanes = [
  {
    id: "cloud",
    title: "landing.tech.compare.cloudFlow.title",
    titleClassName: "text-destructive",
    sees: "landing.tech.backup.diagram.cloudSees",
    sample: "landing.tech.backup.diagram.receipt",
    stage: backupLane(true),
  },
  {
    id: "payky",
    title: "landing.tech.compare.paykyFlow.title",
    titleClassName: "text-(--landing-ink)",
    sees: "landing.tech.backup.diagram.sees",
    sample: undefined,
    stage: backupLane(false),
  },
] as const satisfies ReadonlyArray<{
  readonly id: string
  readonly title: TranslationKey
  readonly titleClassName: string
  readonly sees: TranslationKey
  readonly sample: TranslationKey | undefined
  readonly stage: StageLayout
}>

// What a relay holds: bytes, not sales. Not copy, so not translated.
export const cipherSample = "9f3a e71c 04bd c2a8 5e19 b7f0 1d6e 83c4 …"

/**
 * Where the backup goes and who can read it: through a provider's server
 * readable to everyone who reaches it, or through a relay that sees noise.
 * Laid out across on every screen; three steps fit a phone.
 */
export function BackupDiagram() {
  const { t } = useLandingTranslation()
  return (
    <Reveal className="mt-12 rounded-3xl bg-card p-6 shadow-sm sm:p-8">
      <div className="grid gap-x-6 gap-y-1 md:grid-cols-[8rem_minmax(0,1fr)]">
        <div className="max-md:hidden" />
        <div className="relative h-10">
          {backupSteps.map((step) => (
            <span
              key={step.id}
              className={cn(
                stepLabelClassName,
                "bottom-0 max-w-[7rem] -translate-x-1/2 text-center md:max-w-[9rem] md:text-sm"
              )}
              style={{ left: percent(step.x) }}
            >
              {t(step.label)}
            </span>
          ))}
        </div>
        {backupLanes.map((lane) => (
          <Fragment key={lane.id}>
            <div className="relative max-md:mt-4">
              <p
                className={cn(
                  "font-semibold text-pretty md:absolute md:inset-x-0 md:-translate-y-1/2",
                  lane.titleClassName
                )}
                style={{ top: percent(backupLaneY) }}
              >
                {t(lane.title)}
              </p>
            </div>
            <StageView stage={lane.stage} wide className="h-36" />
          </Fragment>
        ))}
      </div>
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {backupPeople.map((person) => {
          const Icon = person.icon
          return (
            <li key={person.id} className="flex items-center gap-1.5">
              <Icon aria-hidden="true" className="size-4" />
              {t(person.label)}
            </li>
          )
        })}
      </ul>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {backupLanes.map((lane) => (
          <div
            key={lane.id}
            className="flex flex-col gap-1 rounded-xl bg-muted/60 px-4 py-3"
          >
            <span
              className={cn(
                "font-mono text-xs font-semibold tracking-[0.08em] uppercase",
                lane.titleClassName
              )}
            >
              {t(lane.sees)}
            </span>
            <code
              className={cn(
                "font-mono text-sm text-muted-foreground",
                lane.sample === undefined ? "break-all" : "text-pretty"
              )}
            >
              {lane.sample === undefined ? cipherSample : t(lane.sample)}
            </code>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm leading-relaxed text-pretty text-muted-foreground">
        {t("landing.tech.backup.diagram.caption")}
      </p>
    </Reveal>
  )
}

// Merchants around one database; rounded so the server and the browser
// write the same style and the page hydrates without a mismatch.
const merchantPoints: ReadonlyArray<Point> = Array.from(
  { length: 10 },
  (_, index) => {
    const angle = (index / 10) * 2 * Math.PI - Math.PI / 2
    return {
      x: Math.round((50 + 38 * Math.cos(angle)) * 10) / 10,
      y: Math.round((50 + 38 * Math.sin(angle)) * 10) / 10,
    }
  }
)

// Devices scattered with no centre to strike.
const devicePoints: ReadonlyArray<Point> = [
  { x: 16, y: 18 },
  { x: 48, y: 12 },
  { x: 82, y: 22 },
  { x: 28, y: 46 },
  { x: 66, y: 44 },
  { x: 12, y: 78 },
  { x: 44, y: 76 },
  { x: 86, y: 70 },
  { x: 62, y: 90 },
]

const pointKey = (point: Point) => `${point.x}-${point.y}`

// Which side a card stands for, in the colours the other comparisons use.
const targetSides = {
  cloud: {
    title: "landing.tech.compare.cloudFlow.title",
    titleClassName: "text-destructive",
    cardClassName: "",
  },
  payky: {
    title: "landing.tech.compare.paykyFlow.title",
    titleClassName: "text-(--landing-ink)",
    cardClassName: "relative isolate overflow-hidden bg-accent",
  },
} as const satisfies Record<
  string,
  {
    readonly title: TranslationKey
    readonly titleClassName: string
    readonly cardClassName: string
  }
>

function TargetCard({
  side,
  label,
  children,
}: {
  readonly side: keyof typeof targetSides
  readonly label: TranslationKey
  readonly children: ReactNode
}) {
  const { t } = useLandingTranslation()
  const { title, titleClassName, cardClassName } = targetSides[side]
  return (
    <Reveal
      className={cn(
        "flex h-full flex-col items-center gap-6 rounded-3xl bg-card p-6 text-center shadow-sm",
        cardClassName
      )}
    >
      {side === "payky" ? <PaykyWatermark /> : null}
      <p className={cn("text-lg font-semibold text-pretty", titleClassName)}>
        {t(title)}
      </p>
      <div className="relative aspect-square w-full max-w-72">{children}</div>
      <p className="leading-relaxed text-pretty text-muted-foreground">
        {t(label)}
      </p>
    </Reveal>
  )
}

/** One database every merchant feeds, against devices with nothing joining them. */
export function TargetDiagram() {
  const center: Point = { x: 50, y: 50 }
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-2">
      <TargetCard side="cloud" label="landing.tech.security.diagram.cloud">
        <svg
          className="landing-network"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {[14, 22].map((radius) => (
            <circle
              key={radius}
              cx={center.x}
              cy={center.y}
              r={radius}
              className="fill-none stroke-destructive/40"
              strokeWidth={1}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {merchantPoints.map((point) => (
            <line
              key={pointKey(point)}
              x1={point.x}
              y1={point.y}
              x2={center.x}
              y2={center.y}
              className="stroke-border"
              strokeWidth={1.5}
              strokeDasharray="2 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {merchantPoints.map((point, index) => (
          <Pulse
            key={pointKey(point)}
            from={point}
            to={center}
            delay={index * 0.32}
            className="landing-pulse-risk"
          />
        ))}
        {merchantPoints.map((point) => (
          <StageNodeView
            key={pointKey(point)}
            node={{
              id: pointKey(point),
              icon: StoreIcon,
              small: true,
              at: point,
            }}
            position={point}
          />
        ))}
        <StageNodeView
          node={{
            id: "database",
            icon: DatabaseIcon,
            tone: "risk",
            at: center,
          }}
          position={center}
        />
      </TargetCard>
      <TargetCard side="payky" label="landing.tech.security.diagram.payky">
        {devicePoints.map((point) => (
          <div
            key={pointKey(point)}
            className="landing-node"
            style={{ left: percent(point.x), top: percent(point.y) }}
          >
            <span className="relative flex size-11 items-center justify-center rounded-full bg-card text-(--landing-ink) shadow-md">
              <SmartphoneIcon aria-hidden="true" className="size-5" />
              <LockIcon
                aria-hidden="true"
                className="absolute -right-1 -bottom-1 size-5 rounded-full bg-primary p-1 text-primary-foreground"
              />
            </span>
          </div>
        ))}
      </TargetCard>
    </div>
  )
}

/**
 * The outline of a gear with `teeth` trapezoid teeth between two radii,
 * rounded so the server and the browser draw the same path.
 */
const gearPath = (
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  teeth: number
): string => {
  const step = (2 * Math.PI) / teeth
  const at = (radius: number, angle: number) =>
    `${Math.round((cx + radius * Math.cos(angle)) * 10) / 10} ${
      Math.round((cy + radius * Math.sin(angle)) * 10) / 10
    }`
  const points = Array.from({ length: teeth }, (_, index) => {
    const start = index * step
    return [
      at(inner, start),
      at(outer, start + step * 0.2),
      at(outer, start + step * 0.45),
      at(inner, start + step * 0.65),
    ].join(" L ")
  })
  return `M ${points.join(" L ")} Z`
}

/** A gear that turns on its own centre; the mechanism on display. */
function Gear({
  cx,
  cy,
  outer,
  teeth,
  reverse = false,
  seconds,
}: {
  readonly cx: number
  readonly cy: number
  readonly outer: number
  readonly teeth: number
  readonly reverse?: boolean
  readonly seconds: number
}) {
  return (
    <g
      className={cn("landing-gear", reverse && "landing-gear-reverse")}
      style={{ animationDuration: `${seconds}s` }}
    >
      <path
        d={gearPath(cx, cy, outer, outer * 0.8, teeth)}
        fill="url(#glass-safe-brass)"
        stroke="#7c5a12"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <circle
        cx={cx}
        cy={cy}
        r={outer * 0.52}
        fill="none"
        stroke="#7c5a12"
        strokeOpacity={0.5}
        strokeWidth={0.8}
      />
      <circle cx={cx} cy={cy} r={outer * 0.18} fill="#5c4210" />
    </g>
  )
}

/** Gradients both safes and the loupe paint with; drawn once, defined once. */
function SafeDefs() {
  return (
    <svg aria-hidden="true" className="absolute size-0">
      <defs>
        <linearGradient id="glass-safe-steel-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4e55" />
          <stop offset="0.5" stopColor="#2a2d32" />
          <stop offset="1" stopColor="#121417" />
        </linearGradient>
        <linearGradient id="glass-safe-door-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#33363c" />
          <stop offset="1" stopColor="#17191c" />
        </linearGradient>
        <radialGradient id="glass-safe-dial" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#c9ced6" />
          <stop offset="0.55" stopColor="#7d838c" />
          <stop offset="1" stopColor="#3b3f45" />
        </radialGradient>
        <linearGradient id="glass-safe-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f3f6" />
          <stop offset="0.5" stopColor="#a9afb8" />
          <stop offset="1" stopColor="#6b717a" />
        </linearGradient>
        <linearGradient id="glass-safe-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d77a" />
          <stop offset="0.55" stopColor="#d9a52c" />
          <stop offset="1" stopColor="#a8761a" />
        </linearGradient>
        <linearGradient id="glass-safe-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#e6f0f5" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="glass-safe-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter
          id="glass-safe-shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
    </svg>
  )
}

/** Where the safes' dial sits, so the loupe and the gears agree. */
const dial = { cx: 92, cy: 96 } as const

/** Feet and floor shadow every safe stands on. */
function SafeBase({ feet }: { readonly feet: string }) {
  return (
    <>
      <ellipse
        cx="100"
        cy="214"
        rx="84"
        ry="7"
        fill="#000"
        opacity="0.28"
        filter="url(#glass-safe-shadow)"
      />
      <rect x="28" y="200" width="22" height="10" rx="2" fill={feet} />
      <rect x="150" y="200" width="22" height="10" rx="2" fill={feet} />
    </>
  )
}

/** A closed steel safe: everything about it is on the outside. */
function SteelSafe() {
  const ticks = Array.from({ length: 24 }, (_, index) => index * 15)
  return (
    <svg viewBox="0 0 200 220" aria-hidden="true" className="size-full">
      <SafeBase feet="#0d0e10" />
      <rect
        x="10"
        y="8"
        width="180"
        height="194"
        rx="14"
        fill="url(#glass-safe-steel-dark)"
        stroke="#000"
        strokeOpacity="0.6"
      />
      <rect
        x="12"
        y="10"
        width="176"
        height="190"
        rx="12"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.12"
      />
      <rect
        x="26"
        y="24"
        width="148"
        height="162"
        rx="8"
        fill="url(#glass-safe-door-dark)"
        stroke="#000"
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <rect
        x="28"
        y="26"
        width="144"
        height="158"
        rx="7"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.07"
      />
      {[52, 148].map((y) => (
        <rect
          key={y}
          x="19"
          y={y}
          width="9"
          height="20"
          rx="3"
          fill="url(#glass-safe-chrome)"
        />
      ))}
      <circle cx={dial.cx} cy={dial.cy} r="34" fill="#0b0c0e" opacity="0.6" />
      <circle
        cx={dial.cx}
        cy={dial.cy}
        r="30"
        fill="url(#glass-safe-dial)"
        stroke="#1b1d20"
        strokeWidth="1.5"
      />
      {ticks.map((angle) => (
        <line
          key={angle}
          x1={dial.cx}
          y1={dial.cy - 30}
          x2={dial.cx}
          y2={dial.cy - (angle % 45 === 0 ? 23 : 26)}
          stroke="#1b1d20"
          strokeWidth="1"
          transform={`rotate(${angle} ${dial.cx} ${dial.cy})`}
        />
      ))}
      <circle
        cx={dial.cx}
        cy={dial.cy}
        r="11"
        fill="url(#glass-safe-chrome)"
        stroke="#2a2d32"
      />
      <path
        d={`M ${dial.cx - 4} ${dial.cy - 40} L ${dial.cx + 4} ${dial.cy - 40} L ${dial.cx} ${dial.cy - 34} Z`}
        fill="#d9a52c"
      />
      <g>
        <rect
          x="134"
          y="84"
          width="10"
          height="24"
          rx="3"
          fill="url(#glass-safe-chrome)"
        />
        <rect
          x="128"
          y="122"
          width="22"
          height="44"
          rx="6"
          fill="url(#glass-safe-chrome)"
          stroke="#2a2d32"
        />
        <rect x="136" y="128" width="6" height="32" rx="3" fill="#2a2d32" />
      </g>
      <path
        d="M 30 186 L 70 24 L 92 24 L 52 186 Z"
        fill="url(#glass-safe-sheen)"
        opacity="0.12"
      />
    </svg>
  )
}

/** A glass safe: its whole mechanism in view, its bolts still shot home. */
function GlassSafe() {
  return (
    <svg viewBox="0 0 200 220" aria-hidden="true" className="size-full">
      <SafeBase feet="#6b717a" />
      <rect
        x="10"
        y="8"
        width="180"
        height="194"
        rx="14"
        fill="url(#glass-safe-glass)"
        stroke="url(#glass-safe-chrome)"
        strokeWidth="5"
      />
      <rect
        x="26"
        y="24"
        width="148"
        height="162"
        rx="8"
        fill="none"
        stroke="url(#glass-safe-chrome)"
        strokeWidth="2"
        strokeOpacity="0.8"
      />
      {[52, 148].map((y) => (
        <rect
          key={y}
          x="19"
          y={y}
          width="9"
          height="20"
          rx="3"
          fill="url(#glass-safe-chrome)"
        />
      ))}
      {[60, 105, 150].map((y) => (
        <g key={y}>
          <rect
            x="136"
            y={y - 5}
            width="52"
            height="10"
            rx="3"
            fill="url(#glass-safe-chrome)"
            stroke="#5f656e"
            strokeWidth="0.8"
          />
          <rect
            x="172"
            y={y - 6.5}
            width="14"
            height="13"
            rx="2"
            fill="#5f656e"
            opacity="0.55"
          />
        </g>
      ))}
      <rect
        x="128"
        y="52"
        width="8"
        height="106"
        rx="3"
        fill="url(#glass-safe-chrome)"
        stroke="#5f656e"
        strokeWidth="0.8"
      />
      <Gear cx={dial.cx} cy={dial.cy} outer={30} teeth={16} seconds={14} />
      <Gear cx={122} cy={140} outer={17} teeth={9} reverse seconds={8} />
      <Gear cx={58} cy={150} outer={14} teeth={8} reverse seconds={7} />
      <circle
        cx={dial.cx}
        cy={dial.cy}
        r="11"
        fill="url(#glass-safe-chrome)"
        stroke="#5f656e"
      />
      <path
        d="M 34 186 L 78 24 L 98 24 L 54 186 Z"
        fill="url(#glass-safe-sheen)"
        opacity="0.7"
      />
      <path
        d="M 110 186 L 140 24 L 148 24 L 118 186 Z"
        fill="url(#glass-safe-sheen)"
        opacity="0.45"
      />
    </svg>
  )
}

/**
 * A magnifying glass that wanders over a safe and shows, enlarged, what it
 * finds: the lens is HTML, so what it holds can be translated text or an
 * icon; the rim, glare and handle are SVG.
 */
function Loupe({
  lensClassName,
  children,
}: {
  readonly lensClassName: string
  readonly children: ReactNode
}) {
  return (
    <div
      aria-hidden="true"
      className="landing-loupe absolute top-[26%] left-[26%] z-10 size-[46%] drop-shadow-xl"
    >
      <div
        className={cn(
          "absolute top-[10%] left-[10%] flex size-[60%] items-center justify-center overflow-hidden rounded-full",
          lensClassName
        )}
      >
        {children}
      </div>
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="absolute inset-0 size-full"
      >
        <path
          d="M 60 60 L 90 90"
          stroke="#1f2226"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 62 62 L 88 88"
          stroke="#fff"
          strokeOpacity="0.15"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 58 58 L 66 66"
          stroke="url(#glass-safe-chrome)"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <circle
          cx="40"
          cy="40"
          r="31"
          fill="none"
          stroke="url(#glass-safe-chrome)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r="28"
          fill="none"
          stroke="#000"
          strokeOpacity="0.25"
          strokeWidth="1"
        />
        <path
          d="M 20 30 A 22 22 0 0 1 36 17"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.85"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="25" cy="27" r="9" fill="#fff" opacity="0.12" />
      </svg>
    </div>
  )
}

/**
 * Security by obscurity against security by transparency: a steel safe
 * stamped "trust us", whose inside the loupe cannot see, and a glass safe
 * whose every gear is in view and which still stays locked, because the key
 * is only the merchant's.
 */
export function GlassSafeDiagram() {
  const { t } = useLandingTranslation()
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-2">
      <SafeDefs />
      <TargetCard side="cloud" label="landing.tech.transparency.diagram.cloud">
        <div className="absolute inset-[6%]">
          <SteelSafe />
        </div>
        <Loupe lensClassName="bg-[radial-gradient(circle_at_35%_30%,#3a3d42,#121417)]">
          <span className="text-2xl font-black tracking-widest text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)] sm:text-3xl">
            ???
          </span>
        </Loupe>
        <p className="absolute right-0 bottom-[8%] z-20 -rotate-[9deg] rounded-sm bg-destructive/12 px-2.5 py-1 font-mono text-xs font-bold tracking-[0.1em] text-destructive uppercase shadow-sm">
          {t("landing.tech.transparency.diagram.stamp")}
        </p>
      </TargetCard>
      <TargetCard side="payky" label="landing.tech.transparency.diagram.payky">
        <div className="absolute inset-[6%]">
          <GlassSafe />
        </div>
        <Loupe lensClassName="bg-[radial-gradient(circle_at_35%_30%,#ffffff,#e8eef2)] dark:bg-[radial-gradient(circle_at_35%_30%,#3b4148,#1f2328)]">
          <svg viewBox="0 0 100 100" aria-hidden="true" className="size-full">
            <Gear cx={50} cy={50} outer={42} teeth={14} seconds={14} />
          </svg>
        </Loupe>
        <span className="absolute bottom-[4%] left-[2%] z-20 flex size-12 items-center justify-center rounded-full bg-card text-(--landing-ink) shadow-md">
          <SmartphoneIcon aria-hidden="true" className="size-5" />
          <KeyRoundIcon
            aria-hidden="true"
            className="absolute -right-1 -bottom-1 size-5 rounded-full bg-primary p-1 text-primary-foreground"
          />
        </span>
      </TargetCard>
    </div>
  )
}
