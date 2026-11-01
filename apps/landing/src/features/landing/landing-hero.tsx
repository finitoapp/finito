import type { LucideIcon } from "lucide-react"
import {
  BanknoteIcon,
  DownloadIcon,
  LandmarkIcon,
  PlayIcon,
  ZapIcon,
} from "lucide-react"
import { type PointerEvent, useId } from "react"
import { buttonVariants } from "@/components/ui/button.tsx"
import { landingAppEntryUrl } from "@/core/landing-site.ts"
import {
  mockupHeight,
  mockupsByLanguage,
  mockupWidth,
} from "@/features/landing/landing-mockups.ts"
import {
  Glow,
  Placed,
  type Point,
  Pulse,
  percent,
} from "@/features/landing/landing-parts.tsx"
import { useLandingTranslation } from "@/features/landing/landing-translation.ts"
import type { TranslationKey } from "@/i18n/resources.ts"
import { cn } from "@/lib/utils.ts"

interface StageNode extends Point {
  readonly icon: LucideIcon
  readonly label: TranslationKey
}

// Percent positions around the phones; the hub is where a payment arrives.
const hub: Point = { x: 64, y: 44 }
const nodes: ReadonlyArray<StageNode> = [
  // Far enough in that a chip centred on its point stays inside a phone-wide stage.
  { icon: LandmarkIcon, label: "landing.stage.transfer", x: 22, y: 5 },
  { icon: BanknoteIcon, label: "landing.stage.cash", x: 14, y: 97 },
  { icon: ZapIcon, label: "landing.stage.bitcoin", x: 97, y: 62 },
]

/** The ways to pay, each sending a spark of light into the phone. */
function Network() {
  const { t } = useLandingTranslation()
  return (
    <>
      <svg
        className="landing-network"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {nodes.map((node) => (
          <line
            key={node.label}
            x1={node.x}
            y1={node.y}
            x2={hub.x}
            y2={hub.y}
            className="stroke-border"
            strokeWidth={1}
            strokeDasharray="2 6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {nodes.map((node, index) => (
        <Pulse key={node.label} from={node} to={hub} delay={index * 1.1} />
      ))}
      {/* A ripple where each spark lands, one pulse period after it sets off. */}
      {nodes.map((node, index) => (
        <div
          key={node.label}
          aria-hidden="true"
          className="landing-ping z-10"
          style={{
            left: percent(hub.x),
            top: percent(hub.y),
            animationDelay: `${index * 1.1 + 3.2}s`,
          }}
        />
      ))}
      {nodes.map((node) => {
        const Icon = node.icon
        return (
          <div
            key={node.label}
            className="landing-node z-10"
            style={{ left: percent(node.x), top: percent(node.y) }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-card/90 py-1.5 pr-3.5 pl-2.5 text-sm font-medium whitespace-nowrap shadow-lg backdrop-blur-sm">
              <Icon
                aria-hidden="true"
                className="size-4 text-(--landing-ink)"
              />
              {t(node.label)}
            </span>
          </div>
        )
      })}
    </>
  )
}

// The coin rim of the logo: 40 flat-topped teeth with shallow notches
// between them (tops 4.7° of a 9° period, notches 2.8 % deep), in a 200-unit box.
const stampRim =
  "M100.0,4.8 L103.7,2.1 L111.7,2.7 L114.9,6.0 L119.0,3.8 L126.8,5.7 L129.4,9.5 L133.8,8.0 L141.2,11.1 L143.2,15.2 L147.7,14.4 L154.6,18.6 L156.0,23.0 L160.5,22.9 L166.6,28.2 L167.3,32.7 L171.8,33.4 L177.1,39.5 L177.0,44.0 L181.4,45.4 L185.6,52.3 L184.8,56.8 L188.9,58.8 L192.0,66.2 L190.5,70.6 L194.3,73.2 L196.2,81.0 L194.0,85.1 L197.3,88.3 L197.9,96.3 L195.2,100.0 L197.9,103.7 L197.3,111.7 L194.0,114.9 L196.2,119.0 L194.3,126.8 L190.5,129.4 L192.0,133.8 L188.9,141.2 L184.8,143.2 L185.6,147.7 L181.4,154.6 L177.0,156.0 L177.1,160.5 L171.8,166.6 L167.3,167.3 L166.6,171.8 L160.5,177.1 L156.0,177.0 L154.6,181.4 L147.7,185.6 L143.2,184.8 L141.2,188.9 L133.8,192.0 L129.4,190.5 L126.8,194.3 L119.0,196.2 L114.9,194.0 L111.7,197.3 L103.7,197.9 L100.0,195.2 L96.3,197.9 L88.3,197.3 L85.1,194.0 L81.0,196.2 L73.2,194.3 L70.6,190.5 L66.2,192.0 L58.8,188.9 L56.8,184.8 L52.3,185.6 L45.4,181.4 L44.0,177.0 L39.5,177.1 L33.4,171.8 L32.7,167.3 L28.2,166.6 L22.9,160.5 L23.0,156.0 L18.6,154.6 L14.4,147.7 L15.2,143.2 L11.1,141.2 L8.0,133.8 L9.5,129.4 L5.7,126.8 L3.8,119.0 L6.0,114.9 L2.7,111.7 L2.1,103.7 L4.8,100.0 L2.1,96.3 L2.7,88.3 L6.0,85.1 L3.8,81.0 L5.7,73.2 L9.5,70.6 L8.0,66.2 L11.1,58.8 L15.2,56.8 L14.4,52.3 L18.6,45.4 L23.0,44.0 L22.9,39.5 L28.2,33.4 L32.7,32.7 L33.4,28.2 L39.5,22.9 L44.0,23.0 L45.4,18.6 L52.3,14.4 L56.8,15.2 L58.8,11.1 L66.2,8.0 L70.6,9.5 L73.2,5.7 L81.0,3.8 L85.1,6.0 L88.3,2.7 L96.3,2.1 Z"

// Cut out of the rim (even-odd), leaving a band with the teeth on its outside.
const stampRimHole = "M12,100 a88,88 0 1,0 176,0 a88,88 0 1,0 -176,0 Z"

/**
 * A rubber stamp, as an official approval: the coin's serrated rim, an
 * inner ring, the text between two rules, all in one ink on a transparent
 * background. The filter roughens the edges and takes speckles out of the
 * ink, the way a real print comes out.
 */
function EetStamp() {
  const { t } = useLandingTranslation()
  const filterId = useId()
  // "Vyřeší EET" on two lines: the verb above, the acronym below.
  const lines = t("landing.stage.eet").split(" ")

  return (
    <svg
      viewBox="0 0 200 200"
      className="size-full text-(--landing-ink)"
      role="img"
      aria-label={t("landing.stage.eet")}
    >
      <defs>
        <filter id={filterId} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="3"
            seed="4"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.6"
            result="rough"
          />
          {/* Thresholds the noise into a few missing specks, not a worn print. */}
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.6"
            result="speckle"
          />
          <feComposite in="rough" in2="speckle" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} fill="currentColor" opacity={0.95}>
        <path d={`${stampRim} ${stampRimHole}`} fillRule="evenodd" />
        <circle
          cx={100}
          cy={100}
          r={80}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        />
        <text
          x={100}
          y={94}
          textAnchor="middle"
          fontSize={32}
          fontWeight={900}
          letterSpacing={-0.5}
        >
          {lines.map((line, index) => (
            <tspan key={line} x={100} dy={index === 0 ? 0 : 36}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    </svg>
  )
}

/** Leans the phones after a mouse through `--landing-px/py` (landing.css). */
function tiltToward(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== "mouse") return
  const rect = event.currentTarget.getBoundingClientRect()
  const style = event.currentTarget.style
  style.setProperty(
    "--landing-px",
    String(((event.clientX - rect.left) / rect.width) * 2 - 1)
  )
  style.setProperty(
    "--landing-py",
    String(((event.clientY - rect.top) / rect.height) * 2 - 1)
  )
}

function resetTilt(event: PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.removeProperty("--landing-px")
  event.currentTarget.style.removeProperty("--landing-py")
}

/** Two tilted phones in a pool of accent light: the keypad behind, the QR in front. */
function Stage() {
  const { language, t } = useLandingTranslation()
  const mockups = mockupsByLanguage[language]

  return (
    <div
      className="relative mx-auto aspect-[0.82] w-full max-w-md lg:max-w-lg"
      onPointerMove={tiltToward}
      onPointerLeave={resetTilt}
    >
      <Glow size="110%" top="50%" left="58%" />
      <Network />
      <Placed left="-4%" top="18%" width="56%" className="landing-tilt-back">
        <img
          src={mockups.home}
          alt={t("landing.mockup.home.alt")}
          width={mockupWidth}
          height={mockupHeight}
          className="w-full opacity-75 drop-shadow-2xl"
          loading="eager"
        />
      </Placed>
      <Placed right="2%" top="0" width="64%" className="landing-tilt">
        <img
          src={mockups.payment}
          alt={t("landing.mockup.payment.alt")}
          width={mockupWidth}
          height={mockupHeight}
          className="w-full drop-shadow-2xl"
          loading="eager"
          // The largest thing in the first view.
          fetchPriority="high"
        />
        {/* Over the QR card of the payment mockup, the same in every language. */}
        <div
          aria-hidden="true"
          className="landing-scan absolute top-[37.1%] left-[21.8%] h-[32%] w-[56.4%]"
        />
      </Placed>
      {/* Stamped on the phone's corner: the one thing a Czech merchant asks first. */}
      <Placed right="-2%" bottom="-2%" className="landing-stamp z-20">
        <div className="size-32 -rotate-12 sm:size-40">
          <EetStamp />
        </div>
      </Placed>
    </div>
  )
}

/** The title with its accent words set in the accent color. */
function AccentedTitle() {
  const { t } = useLandingTranslation()
  const title = t("landing.hero.title")
  const accent = t("landing.hero.titleAccent")
  const [before = "", after = ""] = title.split(accent)

  return (
    <h1 className="landing-rise text-5xl font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
      {before}
      <span className="landing-shine">{accent}</span>
      {after}
    </h1>
  )
}

export function LandingHero() {
  const { language, t } = useLandingTranslation()

  return (
    <section className="landing-dots relative isolate overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pt-24 lg:pb-24">
        <div className="flex flex-col gap-7">
          <AccentedTitle />
          <p className="landing-rise landing-delay-1 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
            {t("landing.hero.subtitle")}
          </p>
          <div className="landing-rise landing-delay-2 flex flex-wrap gap-3">
            <a
              // A plain link: the app is another document (landing/0003).
              href={landingAppEntryUrl(language)}
              className={cn(
                buttonVariants({ size: "lg" }),
                "landing-nudge h-12 rounded-full px-7 text-base font-semibold has-data-[icon=inline-start]:pl-6"
              )}
            >
              <PlayIcon aria-hidden="true" data-icon="inline-start" />
              {t("landing.cta.start")}
            </a>
            <a
              href="#download"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 rounded-full px-7 text-base font-semibold has-data-[icon=inline-start]:pl-6"
              )}
            >
              <DownloadIcon aria-hidden="true" data-icon="inline-start" />
              {t("landing.cta.download")}
            </a>
          </div>
        </div>
        <div className="landing-rise landing-delay-3 py-6 lg:py-0">
          <Stage />
        </div>
      </div>
    </section>
  )
}
