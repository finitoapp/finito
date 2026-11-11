import {
  BellOffIcon,
  CheckIcon,
  ClockIcon,
  CodeIcon,
  CoffeeIcon,
  CrosshairIcon,
  EyeIcon,
  FileCheckIcon,
  FileLockIcon,
  FlaskConicalIcon,
  GaugeIcon,
  KeyRoundIcon,
  LockIcon,
  type LucideIcon,
  MessageSquareQuoteIcon,
  MonitorSmartphoneIcon,
  PlayIcon,
  QrCodeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  UserRoundCheckIcon,
  WalletIcon,
  XIcon,
} from "lucide-react"
import { landingAppEntryUrl, landingTechPaths } from "@/core/landing-site.ts"
import {
  Faq,
  type FaqItem,
  githubUrl,
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
import {
  BackupDiagram,
  CompareDiagram,
  cipherSample,
  GlassSafeDiagram,
  MoneyDiagram,
  TargetDiagram,
} from "@/features/landing/landing-tech-diagrams.tsx"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import type { Language, TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"

// Every claim on this page holds for the code as it is; landing/0009 says
// where each comes from and what the page must not say.

interface TitledText {
  readonly title: TranslationKey
  readonly body: TranslationKey
}

/** One espresso from the counter to the second till, each step leading to its section. */
const journeySteps: ReadonlyArray<
  IconCard & { readonly href: string; readonly encrypted?: boolean }
> = [
  {
    icon: CoffeeIcon,
    title: "landing.tech.journey.sale.title",
    body: "landing.tech.journey.sale.body",
    href: "#local",
  },
  {
    icon: QrCodeIcon,
    title: "landing.tech.journey.pay.title",
    body: "landing.tech.journey.pay.body",
    href: "#money",
  },
  {
    icon: LockIcon,
    title: "landing.tech.journey.encrypt.title",
    body: "landing.tech.journey.encrypt.body",
    href: "#backup",
    encrypted: true,
  },
  {
    icon: MonitorSmartphoneIcon,
    title: "landing.tech.journey.sync.title",
    body: "landing.tech.journey.sync.body",
    href: "#backup",
  },
]

/** The rows of the comparison with a typical cloud app; other apps are not named (landing/0008). */
const compareRows = [
  "data",
  "signup",
  "middleman",
  "outage",
  "reads",
  "shutdown",
  "code",
] as const

const offlineNow = ["bill", "qr", "cash"] as const
const offlineLater = ["bank", "bitcoin", "eet", "sync"] as const

const localPoints: ReadonlyArray<IconCard> = [
  {
    icon: MonitorSmartphoneIcon,
    title: "landing.tech.local.devices.title",
    body: "landing.tech.local.devices.body",
  },
  {
    icon: GaugeIcon,
    title: "landing.tech.local.speed.title",
    body: "landing.tech.local.speed.body",
  },
]

const accountPoints: ReadonlyArray<IconCard> = [
  {
    icon: UserRoundCheckIcon,
    title: "landing.tech.account.why.title",
    body: "landing.tech.account.why.body",
  },
  {
    icon: KeyRoundIcon,
    title: "landing.tech.account.phrase.title",
    body: "landing.tech.account.phrase.body",
  },
  {
    icon: ShieldCheckIcon,
    title: "landing.tech.account.kyc.title",
    body: "landing.tech.account.kyc.body",
  },
]

// A made-up phrase in the word list the app uses. Not copy, so not translated.
const samplePhrase = [
  "garden",
  "ocean",
  "silver",
  "tiger",
  "bread",
  "window",
  "lunar",
  "cotton",
  "museum",
  "frost",
  "anchor",
  "velvet",
  "candy",
  "robot",
  "maple",
  "harbor",
  "pencil",
  "sunset",
  "valley",
  "cherry",
  "rocket",
  "island",
  "puzzle",
  "meadow",
] as const

interface StatusCell {
  readonly ok: boolean
  readonly text: TranslationKey
}

interface StatusRow {
  readonly label: TranslationKey
  readonly note?: TranslationKey
  readonly cells: ReadonlyArray<StatusCell>
}

const kept: StatusCell = { ok: true, text: "landing.tech.account.whatIf.kept" }
const lost: StatusCell = { ok: false, text: "landing.tech.account.whatIf.lost" }

const whatIfColumns: ReadonlyArray<TranslationKey> = [
  "landing.tech.account.whatIf.data",
  "landing.tech.account.whatIf.bitcoin",
  "landing.tech.account.whatIf.bank",
]

const whatIfRows: ReadonlyArray<StatusRow> = [
  {
    label: "landing.tech.account.whatIf.lostPhone.label",
    note: "landing.tech.account.whatIf.lostPhone.note",
    cells: [kept, kept, kept],
  },
  {
    label: "landing.tech.account.whatIf.lostPhrase.label",
    note: "landing.tech.account.whatIf.lostPhrase.note",
    cells: [kept, kept, kept],
  },
  {
    label: "landing.tech.account.whatIf.lostBoth.label",
    note: "landing.tech.account.whatIf.lostBoth.note",
    cells: [lost, lost, kept],
  },
]

const backupPoints: ReadonlyArray<TitledText> = [
  {
    title: "landing.tech.backup.relay.title",
    body: "landing.tech.backup.relay.body",
  },
  {
    title: "landing.tech.backup.content.title",
    body: "landing.tech.backup.content.body",
  },
  {
    title: "landing.tech.backup.metadata.title",
    body: "landing.tech.backup.metadata.body",
  },
  {
    title: "landing.tech.backup.where.title",
    body: "landing.tech.backup.where.body",
  },
  {
    title: "landing.tech.backup.restore.title",
    body: "landing.tech.backup.restore.body",
  },
]

const qrSteps = ["create", "scan", "arrive", "check"] as const

const moneyTexts: ReadonlyArray<TitledText> = [
  {
    title: "landing.tech.money.lightning.title",
    body: "landing.tech.money.lightning.body",
  },
  {
    title: "landing.tech.money.card.title",
    body: "landing.tech.money.card.body",
  },
]

const securityPoints: ReadonlyArray<IconCard> = [
  {
    icon: CrosshairIcon,
    title: "landing.tech.security.target.title",
    body: "landing.tech.security.target.body",
  },
  {
    icon: KeyRoundIcon,
    title: "landing.tech.security.ownership.title",
    body: "landing.tech.security.ownership.body",
  },
  {
    icon: FileLockIcon,
    title: "landing.tech.security.secrets.title",
    body: "landing.tech.security.secrets.body",
  },
  {
    icon: LockIcon,
    title: "landing.tech.security.pin.title",
    body: "landing.tech.security.pin.body",
  },
  {
    icon: BellOffIcon,
    title: "landing.tech.security.tracking.title",
    body: "landing.tech.security.tracking.body",
  },
]

type ServiceId =
  | "web"
  | "relay"
  | "linky"
  | "cashuMints"
  | "linkyWallet"
  | "bank"
  | "eet"
  | "spark"
  | "ai"
  | "serviceProxy"
  | "sentry"
  | "openFacts"
  | "yadio"
  | "switchio"
  | "boltCard"
  | "lightningAddress"
  | "nostr"
  | "support"
  | "contact"
  | "donations"
  | "eetCertificates"

type PaykyServiceId = Extract<
  ServiceId,
  | "web"
  | "relay"
  | "ai"
  | "serviceProxy"
  | "support"
  | "contact"
  | "donations"
  | "eetCertificates"
>

/** Payky's own servers, which also say why they exist (landing/0009). */
const paykyServiceIds: ReadonlySet<ServiceId> = new Set<PaykyServiceId>([
  "web",
  "relay",
  "ai",
  "serviceProxy",
  "support",
  "contact",
  "donations",
  "eetCertificates",
])

const isPaykyService = (id: ServiceId): id is PaykyServiceId =>
  paykyServiceIds.has(id)

/**
 * Everything the app talks to, kept complete by landing/0009, grouped by
 * when it happens; Payky's own servers lead each group.
 */
const serviceGroups: ReadonlyArray<{
  readonly title: TranslationKey
  readonly ids: ReadonlyArray<ServiceId>
}> = [
  {
    title: "landing.tech.services.group.always",
    ids: ["web", "relay", "linky"],
  },
  {
    title: "landing.tech.services.group.enabled",
    ids: [
      "ai",
      "serviceProxy",
      "bank",
      "eet",
      "spark",
      "cashuMints",
      "linkyWallet",
      "sentry",
      "openFacts",
    ],
  },
  {
    title: "landing.tech.services.group.action",
    ids: [
      "support",
      "contact",
      "donations",
      "eetCertificates",
      "yadio",
      "switchio",
      "boltCard",
      "lightningAddress",
      "nostr",
    ],
  },
]

const outageRows: ReadonlyArray<StatusRow> = (
  [
    ["sales", true],
    ["payments", true],
    ["eet", true],
    ["backup", true],
    ["web", true],
    ["extras", false],
  ] as const
).map(([id, ok]) => ({
  label: `landing.tech.exit.outage.${id}.label` as const,
  cells: [{ ok, text: `landing.tech.exit.outage.${id}.state` as const }],
}))

const transparencyPoints: ReadonlyArray<IconCard> = [
  {
    icon: CodeIcon,
    title: "landing.tech.transparency.code.title",
    body: "landing.tech.transparency.code.body",
    link: { label: "landing.tech.exit.code.link", href: githubUrl },
  },
  {
    icon: FileCheckIcon,
    title: "landing.tech.transparency.rules.title",
    body: "landing.tech.transparency.rules.body",
  },
  {
    icon: EyeIcon,
    title: "landing.tech.transparency.limits.title",
    body: "landing.tech.transparency.limits.body",
  },
]

/**
 * One claim of this page followed to the rule and the test that hold it.
 * `landing-server.test.tsx` checks the decision still names that test.
 */
export const transparencyProof = {
  decision: "docs/decisions/eet/0002-eet-never-blocks-checkout.md",
  test: "e2e/eet.spec.ts",
  testName: "the paid screen appears at once while EET cannot be reached",
} as const

const proofSteps: ReadonlyArray<
  TitledText & { readonly icon: LucideIcon; readonly href?: string }
> = [
  {
    icon: MessageSquareQuoteIcon,
    title: "landing.tech.transparency.proof.claim.title",
    body: "landing.tech.transparency.proof.claim.body",
  },
  {
    icon: FileCheckIcon,
    title: "landing.tech.transparency.proof.rule.title",
    body: "landing.tech.transparency.proof.rule.body",
    href: `${githubUrl}/blob/main/${transparencyProof.decision}`,
  },
  {
    icon: FlaskConicalIcon,
    title: "landing.tech.transparency.proof.test.title",
    body: "landing.tech.transparency.proof.test.body",
    href: `${githubUrl}/blob/main/${transparencyProof.test}`,
  },
  {
    icon: UserRoundCheckIcon,
    title: "landing.tech.transparency.proof.you.title",
    body: "landing.tech.transparency.proof.you.body",
  },
]

const exitPoints: ReadonlyArray<IconCard> = [
  {
    icon: SmartphoneIcon,
    title: "landing.tech.exit.data.title",
    body: "landing.tech.exit.data.body",
  },
  {
    icon: RefreshCwIcon,
    title: "landing.tech.exit.sync.title",
    body: "landing.tech.exit.sync.body",
  },
  {
    icon: WalletIcon,
    title: "landing.tech.exit.money.title",
    body: "landing.tech.exit.money.body",
  },
  {
    icon: CodeIcon,
    title: "landing.tech.exit.code.title",
    body: "landing.tech.exit.code.body",
    link: { label: "landing.tech.exit.code.link", href: githubUrl },
  },
]

/** Also the prerendered page's FAQ structured data (landing/0008). */
export const techFaqItems: ReadonlyArray<FaqItem> = (
  [
    "where",
    "read",
    "signup",
    "kyc",
    "lostPhone",
    "lostAll",
    "offline",
    "server",
    "ownRelay",
    "openCode",
  ] as const
).map((id) => ({
  question: `landing.tech.faq.${id}.question` as const,
  answer: `landing.tech.faq.${id}.answer` as const,
}))

const subheadingClassName = "text-2xl font-bold tracking-tight text-balance"

function Hero() {
  const { language, t } = useLandingTranslation()
  return (
    <section className="landing-dots relative isolate overflow-hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-24 lg:pb-24">
        <div className="flex max-w-3xl flex-col gap-7">
          <Eyebrow>{t("landing.tech.hero.eyebrow")}</Eyebrow>
          <h1 className="landing-rise text-5xl font-extrabold tracking-tight text-balance sm:text-6xl">
            {t("landing.tech.hero.title")}
          </h1>
          <p className="landing-rise landing-delay-1 text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
            {t("landing.tech.hero.body")}
          </p>
          <a
            href={landingAppEntryUrl(language)}
            className={cn(
              primaryActionClassName,
              "landing-rise landing-delay-2 w-fit"
            )}
          >
            <PlayIcon aria-hidden="true" data-icon="inline-start" />
            {t("landing.cta.start")}
          </a>
        </div>
        <Journey />
      </div>
    </section>
  )
}

/** One sale followed through the app; the cards double as the page's table of contents. */
function Journey() {
  const { t } = useLandingTranslation()
  return (
    <div className="landing-rise landing-delay-3 flex flex-col gap-5">
      <h2 className={subheadingClassName}>{t("landing.tech.journey.title")}</h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {journeySteps.map((step, index) => {
          const Icon = step.icon
          return (
            <li key={step.title}>
              <a
                href={step.href}
                className="flex h-full flex-col gap-2 rounded-2xl bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex items-center gap-3 text-(--landing-ink)">
                  <span className="font-mono text-sm font-bold">
                    {index + 1}
                  </span>
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  {t(step.title)}
                </span>
                <span className="text-sm leading-relaxed text-pretty text-muted-foreground">
                  {t(step.body)}
                </span>
                {step.encrypted === true ? (
                  <span className="mt-auto flex flex-col gap-1 rounded-xl bg-muted/60 px-3 py-2 font-mono text-xs">
                    <span className="text-pretty line-through decoration-muted-foreground/60">
                      {t("landing.tech.backup.diagram.receipt")}
                    </span>
                    <span className="break-all text-(--landing-ink)">
                      {cipherSample}
                    </span>
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * Payky against a typical cloud app, row by row. On a phone each row turns
 * into a card with its own column labels, so the table never scrolls sideways.
 */
function Compare() {
  const { t } = useLandingTranslation()
  const cloud = t("landing.tech.compare.cloud")
  const payky = t("landing.tech.compare.payky")
  return (
    <Band id="compare" muted>
      <SectionHeading
        eyebrow="landing.tech.compare.eyebrow"
        title="landing.tech.compare.title"
      />
      <Reveal className="mt-12">
        <table className="w-full border-separate border-spacing-y-1 text-left max-md:block">
          <thead className="max-md:sr-only">
            <tr>
              <th scope="col" className="sr-only">
                {t("landing.tech.compare.topic")}
              </th>
              <th
                scope="col"
                className="px-5 pb-4 text-sm font-semibold text-muted-foreground"
              >
                {cloud}
              </th>
              <th
                scope="col"
                className="rounded-t-2xl bg-primary px-5 pt-4 pb-4 text-sm font-bold text-primary-foreground"
              >
                {payky}
              </th>
            </tr>
          </thead>
          <tbody className="max-md:flex max-md:flex-col max-md:gap-4">
            {compareRows.map((row) => (
              <tr
                key={row}
                className="max-md:grid max-md:grid-cols-2 max-md:overflow-hidden max-md:rounded-2xl max-md:bg-card max-md:shadow-sm"
              >
                <th
                  scope="row"
                  className="px-5 py-4 align-top font-semibold max-md:col-span-2 max-md:pb-2"
                >
                  {t(`landing.tech.compare.${row}.label`)}
                </th>
                <td
                  data-label={cloud}
                  className="px-5 py-4 align-top text-muted-foreground before:block before:font-mono before:text-xs before:font-semibold before:tracking-[0.08em] before:uppercase before:content-[attr(data-label)] md:before:hidden"
                >
                  {t(`landing.tech.compare.${row}.cloud`)}
                </td>
                <td
                  data-label={payky}
                  className="bg-accent px-5 py-4 align-top font-semibold before:block before:font-mono before:text-xs before:font-semibold before:tracking-[0.08em] before:text-(--landing-ink) before:uppercase before:content-[attr(data-label)] md:before:hidden"
                >
                  {t(`landing.tech.compare.${row}.payky`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <CompareDiagram />
    </Band>
  )
}

/**
 * A table whose cells say whether something survives, with a mark beside
 * the words. On a phone each row becomes a card, as in the comparison.
 */
function StatusTable({
  caption,
  topic,
  columns,
  rows,
}: {
  readonly caption: TranslationKey
  readonly topic: TranslationKey
  readonly columns: ReadonlyArray<TranslationKey>
  readonly rows: ReadonlyArray<StatusRow>
}) {
  const { t } = useLandingTranslation()
  return (
    <Reveal className="mt-12">
      <table className="w-full border-separate border-spacing-y-1 text-left max-md:block">
        <caption
          className={cn(subheadingClassName, "mb-6 text-left max-md:block")}
        >
          {t(caption)}
        </caption>
        <thead className="max-md:sr-only">
          <tr>
            <th
              scope="col"
              className="px-5 pb-4 text-sm font-semibold text-muted-foreground"
            >
              {t(topic)}
            </th>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-5 pb-4 text-sm font-semibold text-muted-foreground"
              >
                {t(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:flex max-md:flex-col max-md:gap-4">
          {rows.map((row) => (
            <tr
              key={row.label}
              className="max-md:flex max-md:flex-col max-md:overflow-hidden max-md:rounded-2xl max-md:bg-card max-md:shadow-sm"
            >
              <th scope="row" className="px-5 py-4 align-top max-md:pb-2">
                <span className="block font-semibold">{t(row.label)}</span>
                {row.note === undefined ? null : (
                  <span className="block text-sm font-normal text-pretty text-muted-foreground">
                    {t(row.note)}
                  </span>
                )}
              </th>
              {row.cells.map((cell, index) => {
                const column = columns[index]
                const Icon = cell.ok ? CheckIcon : XIcon
                return (
                  <td
                    key={column ?? index}
                    data-label={column === undefined ? undefined : t(column)}
                    className="px-5 py-4 align-top before:block before:font-mono before:text-xs before:font-semibold before:tracking-[0.08em] before:text-muted-foreground before:uppercase before:content-[attr(data-label)] max-md:py-2 md:before:hidden"
                  >
                    <span
                      className={cn(
                        "flex items-start gap-2 font-semibold",
                        cell.ok ? "text-(--landing-ink)" : "text-destructive"
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      {t(cell.text)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Reveal>
  )
}

function OfflineList({
  title,
  icon: Icon,
  items,
}: {
  readonly title: TranslationKey
  readonly icon: LucideIcon
  readonly items: ReadonlyArray<TranslationKey>
}) {
  const { t } = useLandingTranslation()
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <h4 className="font-mono text-xs font-semibold tracking-[0.08em] text-(--landing-ink) uppercase">
        {t(title)}
      </h4>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <Icon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-(--landing-ink)"
            />
            <span className="leading-relaxed text-pretty">{t(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LocalFirst() {
  const { t } = useLandingTranslation()
  return (
    <Band id="local">
      <SectionHeading
        eyebrow="landing.tech.local.eyebrow"
        title="landing.tech.local.title"
        body="landing.tech.local.body"
      />
      <Reveal className="mt-12 flex flex-col gap-6">
        <h3 className={subheadingClassName}>
          {t("landing.tech.local.offline.title")}
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          <OfflineList
            title="landing.tech.local.offline.now.title"
            icon={CheckIcon}
            items={offlineNow.map(
              (id) => `landing.tech.local.offline.now.${id}` as const
            )}
          />
          <OfflineList
            title="landing.tech.local.offline.later.title"
            icon={ClockIcon}
            items={offlineLater.map(
              (id) => `landing.tech.local.offline.later.${id}` as const
            )}
          />
        </div>
        <p className="max-w-3xl leading-relaxed text-pretty text-muted-foreground">
          {t("landing.tech.local.offline.body")}
        </p>
      </Reveal>
      <IconGrid items={localPoints} />
    </Band>
  )
}

function PhraseSample() {
  const { t } = useLandingTranslation()
  return (
    <Reveal className="mt-12 flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
      <p className="text-sm text-pretty text-muted-foreground">
        {t("landing.tech.account.phrase.sample")}
      </p>
      <ol className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4 lg:grid-cols-6">
        {samplePhrase.map((word, index) => (
          <li
            key={word}
            className="flex gap-2 rounded-lg bg-muted/60 px-3 py-1.5"
          >
            <span className="text-muted-foreground">{index + 1}.</span>
            {word}
          </li>
        ))}
      </ol>
    </Reveal>
  )
}

function Account() {
  const { t } = useLandingTranslation()
  return (
    <Band id="account" muted>
      <SectionHeading
        eyebrow="landing.tech.account.eyebrow"
        title="landing.tech.account.title"
        body="landing.tech.account.body"
      />
      <IconGrid items={accountPoints} />
      <PhraseSample />
      <StatusTable
        caption="landing.tech.account.cost.title"
        topic="landing.tech.account.whatIf.topic"
        columns={whatIfColumns}
        rows={whatIfRows}
      />
      <Reveal>
        <p className="mt-6 max-w-3xl leading-relaxed text-pretty">
          {t("landing.tech.account.cost.body")}
        </p>
      </Reveal>
    </Band>
  )
}

function Backup() {
  const { t } = useLandingTranslation()
  return (
    <Band id="backup">
      <SectionHeading
        eyebrow="landing.tech.backup.eyebrow"
        title="landing.tech.backup.title"
        body="landing.tech.backup.body"
      />
      <BackupDiagram />
      <dl className="mt-12 grid gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
        {backupPoints.map((point) => (
          <Reveal key={point.title} className="flex flex-col gap-2">
            <dt className="text-lg font-semibold tracking-tight">
              {t(point.title)}
            </dt>
            <dd className="leading-relaxed text-pretty text-muted-foreground">
              {t(point.body)}
            </dd>
          </Reveal>
        ))}
      </dl>
    </Band>
  )
}

function Money() {
  const { t } = useLandingTranslation()
  return (
    <Band id="money" muted>
      <SectionHeading
        eyebrow="landing.tech.money.eyebrow"
        title="landing.tech.money.title"
        body="landing.tech.money.body"
      />
      <MoneyDiagram />
      <Reveal className="mt-12 flex flex-col gap-5">
        <h3 className="text-xl font-semibold tracking-tight">
          {t("landing.tech.money.qr.title")}
        </h3>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {qrSteps.map((step, index) => (
            <li
              key={step}
              className="flex gap-3 rounded-2xl bg-card p-5 shadow-sm"
            >
              <span className="font-mono text-sm font-bold text-(--landing-ink)">
                {index + 1}
              </span>
              <span className="leading-relaxed text-pretty text-muted-foreground">
                {t(`landing.tech.money.qr.${step}`)}
              </span>
            </li>
          ))}
        </ol>
        <p className="max-w-3xl rounded-2xl bg-accent px-5 py-4 leading-relaxed text-pretty">
          {t("landing.tech.money.qr.note")}
        </p>
      </Reveal>
      <div className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2">
        {moneyTexts.map((item) => (
          <Reveal key={item.title} className="flex flex-col gap-2">
            <h3 className="text-xl font-semibold tracking-tight">
              {t(item.title)}
            </h3>
            <p className="leading-relaxed text-pretty text-muted-foreground">
              {t(item.body)}
            </p>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <p className="mt-8 max-w-3xl leading-relaxed text-pretty text-muted-foreground">
          <strong className="font-semibold text-foreground">
            {t("landing.tech.money.cash.title")}
          </strong>{" "}
          {t("landing.tech.money.cash.body")}
        </p>
      </Reveal>
    </Band>
  )
}

function Security() {
  return (
    <Band id="security">
      <SectionHeading
        eyebrow="landing.tech.security.eyebrow"
        title="landing.tech.security.title"
        body="landing.tech.security.body"
      />
      <TargetDiagram />
      <IconGrid items={securityPoints} />
    </Band>
  )
}

/**
 * Security through transparency rather than obscurity: the glass safe, what
 * makes the claims checkable, one claim followed to its test, and the one
 * thing that cannot be checked yet.
 */
function Transparency() {
  const { t } = useLandingTranslation()
  return (
    <Band id="transparency" muted>
      <SectionHeading
        eyebrow="landing.tech.transparency.eyebrow"
        title="landing.tech.transparency.title"
      />
      <Reveal className="mt-4 max-w-3xl">
        <p className={bodyClassName}>
          <strong className="font-semibold text-foreground">
            {t("landing.tech.transparency.lead")}
          </strong>{" "}
          {t("landing.tech.transparency.body")}
        </p>
      </Reveal>
      <GlassSafeDiagram />
      <IconGrid items={transparencyPoints} />
      <Reveal className="mt-12 flex flex-col gap-5">
        <h3 className={subheadingClassName}>
          {t("landing.tech.transparency.proof.title")}
        </h3>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {proofSteps.map((step, index) => {
            const Icon = step.icon
            const content = (
              <>
                <span className="flex items-center gap-3 text-(--landing-ink)">
                  <span className="font-mono text-sm font-bold">
                    {index + 1}
                  </span>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="font-mono text-xs font-semibold tracking-[0.08em] text-(--landing-ink) uppercase">
                  {t(step.title)}
                </span>
                <span className="leading-relaxed text-pretty">
                  {t(step.body)}
                </span>
              </>
            )
            const className =
              "flex h-full flex-col gap-2 rounded-2xl bg-card p-5 shadow-sm"
            return (
              <li key={step.title}>
                {step.href === undefined ? (
                  <div className={className}>{content}</div>
                ) : (
                  <a
                    href={step.href}
                    className={cn(
                      className,
                      "bg-accent transition-shadow hover:shadow-md"
                    )}
                  >
                    {content}
                  </a>
                )}
              </li>
            )
          })}
        </ol>
      </Reveal>
      <Reveal className="mt-12 flex max-w-3xl flex-col gap-3 rounded-2xl bg-accent p-6">
        <h3 className="text-xl font-semibold tracking-tight">
          {t("landing.tech.transparency.build.title")}
        </h3>
        <p className="leading-relaxed text-pretty">
          {t("landing.tech.transparency.build.body")}
        </p>
      </Reveal>
    </Band>
  )
}

function ServiceFact({
  label,
  value,
}: {
  readonly label: TranslationKey
  readonly value: TranslationKey
}) {
  const { t } = useLandingTranslation()
  return (
    <div>
      <dt className="font-mono text-xs font-semibold tracking-[0.08em] text-(--landing-ink) uppercase">
        {t(label)}
      </dt>
      <dd className="text-pretty text-muted-foreground">{t(value)}</dd>
    </div>
  )
}

function ServiceCard({ id }: { readonly id: ServiceId }) {
  const { t } = useLandingTranslation()
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex flex-col items-start gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            isPaykyService(id)
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {t(
            isPaykyService(id)
              ? "landing.tech.services.owner.payky"
              : "landing.tech.services.owner.third"
          )}
        </span>
        <h4 className="font-semibold tracking-tight break-words">
          {t(`landing.tech.services.${id}.name`)}
        </h4>
      </div>
      <dl className="flex flex-col gap-2 text-sm leading-relaxed">
        <ServiceFact
          label="landing.tech.services.sent"
          value={`landing.tech.services.${id}.sent`}
        />
        <ServiceFact
          label="landing.tech.services.when"
          value={`landing.tech.services.${id}.when`}
        />
        {isPaykyService(id) ? (
          <ServiceFact
            label="landing.tech.services.why"
            value={`landing.tech.services.${id}.why`}
          />
        ) : null}
      </dl>
    </li>
  )
}

function Services() {
  const { t } = useLandingTranslation()
  return (
    <Band id="services">
      <SectionHeading
        eyebrow="landing.tech.services.eyebrow"
        title="landing.tech.services.title"
        body="landing.tech.services.body"
      />
      <Reveal className="mt-10 max-w-3xl">
        <p className="text-2xl font-bold tracking-tight text-balance">
          {t("landing.tech.services.highlight")}
        </p>
      </Reveal>
      {serviceGroups.map((group) => (
        <div key={group.title} className="mt-12 flex flex-col gap-6">
          <h3 className={subheadingClassName}>{t(group.title)}</h3>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.ids.map((id) => (
              <ServiceCard key={id} id={id} />
            ))}
          </ul>
        </div>
      ))}
      <Reveal className="mt-10 max-w-3xl">
        <p className={bodyClassName}>{t("landing.tech.services.footer")}</p>
      </Reveal>
    </Band>
  )
}

function Exit() {
  const { t } = useLandingTranslation()
  return (
    <Band id="exit" muted>
      <SectionHeading
        eyebrow="landing.tech.exit.eyebrow"
        title="landing.tech.exit.title"
        body="landing.tech.exit.body"
      />
      <StatusTable
        caption="landing.tech.exit.outage.title"
        topic="landing.tech.exit.outage.topic"
        columns={["landing.tech.exit.outage.state"]}
        rows={outageRows}
      />
      <Reveal className="mt-12">
        <h3 className={subheadingClassName}>{t("landing.tech.exit.end")}</h3>
      </Reveal>
      <IconGrid items={exitPoints} />
    </Band>
  )
}

/** The page's own call to try it, before the closing every landing page shares. */
function TryIt() {
  const { language, t } = useLandingTranslation()
  return (
    <Band muted>
      <Reveal className="landing-beam flex flex-col gap-5 rounded-3xl p-6 shadow-sm sm:p-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("landing.tech.cta.title")}
          </h2>
          <p className={bodyClassName}>{t("landing.tech.cta.body")}</p>
          <p className="leading-relaxed text-pretty">
            <strong className="font-semibold">
              {t("landing.tech.cta.experiment.title")}
            </strong>{" "}
            {t("landing.tech.cta.experiment.body")}
          </p>
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

/**
 * The page on what makes Payky different (landing/0008): one sale followed
 * through the app under the hero, a comparison with a typical cloud app,
 * then how each part works — local-first, the account, backup, the money's
 * path, security, transparency, everything the app talks to, what happens
 * if Payky goes down or ends — the FAQ and a call to try it. Bands
 * alternate muted and plain below the hero, the FAQ's band included.
 */
export function LandingTechPage({ language }: { readonly language: Language }) {
  return (
    <LandingShell language={language} paths={landingTechPaths}>
      <Hero />
      <Compare />
      <LocalFirst />
      <Account />
      <Backup />
      <Money />
      <Security />
      <Transparency />
      <Services />
      <Exit />
      <Faq items={techFaqItems} muted={false} />
      <TryIt />
    </LandingShell>
  )
}
