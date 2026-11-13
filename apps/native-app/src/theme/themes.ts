import { oklchToHex } from "./oklch.ts"
import { palette } from "./palette.ts"

type Palette = (typeof palette)["light" | "dark"]

/**
 * Tones web picks with a `dark:` class, which a Tamagui variant cannot
 * express: each is one theme key with a light and a dark value. The first
 * two are fazole.fit's fills (`tokens.ts`'s `shape`), on web's palette.
 */
type Tones = Record<
  | "surface-raised"
  | "neutral-soft"
  | "card"
  | "accent-text"
  | "button-outline"
  | "button-outline-pressed"
  | "button-ghost-pressed"
  | "destructive-tint"
  | "destructive-tint-pressed"
  | "input-bg"
  | "input-disabled"
  | "switch-track-off"
  | "switch-thumb-on"
  | "switch-thumb-off"
  | "tabs-trigger"
  | "track"
  | "tile"
  | "tile-primary-10"
  | "tile-primary-15"
  | "tile-info-10"
  | "tile-accent"
  | "nav-bar",
  string
>

/**
 * The light page: a near-neutral cool grey a step below web's `:root`
 * background (`#fbfaf7`, L 0.985), under white blocks, as Linky's light
 * theme lays its `surface` on `slate100`. Two rules make it one system with
 * the dark page:
 *
 * - One temperature. Web's light neutrals are split — a warm page, card and
 *   `muted` under cool slate text, borders and fields — and the ink's veils
 *   go dead grey over the warm ones. Here every neutral takes the dark
 *   page's hue at its faintness: near white, a chroma the dark page can
 *   carry reads as icy blue, so the page is the dark theme's text color
 *   (`#eff0f1`), its mirror, and the gold stays the only hue.
 * - One direction. A block on the page — a card, a tile, a panel — is lifted
 *   above it, lighter, as on the dark page; a field, a chip or a secondary
 *   button sinks into the block. The `tile*` keys are a block that is not a
 *   `Card`: white here, the neutral fill on the dark page.
 *
 * `app.config.ts`'s splash and `public/index.html` paint the same page
 * before the app does (`themes.test.ts`).
 */
const lightPage = { l: 0.955, c: 0.0015, h: 255 } as const
const white = "#ffffff"
const lightMuted = { l: 0.97, c: 0.0015, h: 255 } as const

/** Web's warm light neutrals, in the slate. */
const lightSurfaces = {
  popover: white,
  muted: oklchToHex({ ...lightMuted, alpha: 1 }),
  "muted-50": oklchToHex({ ...lightMuted, alpha: 0.5 }),
  "muted-20": oklchToHex({ ...lightMuted, alpha: 0.2 }),
} as const satisfies Partial<Record<keyof Palette, string>>

/**
 * A translucent `#rrggbbaa` tone laid on `base`, as one opaque color: a tint
 * on a white tile, which over the grey page would read as beige.
 */
const opaqueOver = (tone: string, base: string): string => {
  const channel = (hex: string, index: number) =>
    Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
  const alpha = tone.length === 9 ? channel(tone, 3) / 255 : 1
  return `#${[0, 1, 2]
    .map((index) =>
      Math.round(
        channel(tone, index) * alpha + channel(base, index) * (1 - alpha)
      )
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`
}

/**
 * The light page's fills inside the cards and on the page: one veil of the
 * ink, in the dark page's order — `neutral-soft` < `surface-raised` <
 * pressed — so a secondary button stays louder than a field. The steps are
 * about 40 % of the dark page's, which loses its near-black differences on a
 * phone where a light one does not.
 */
const lightVeil = (alpha: number) =>
  oklchToHex({ l: 0.2, c: 0.02, h: 260, alpha })

const lightTones = (colors: Palette): Tones => ({
  // fazole.fit's `surfaceRaised` (a secondary button, a list's raised tile)
  // and `neutralSoft` (a field, an outline button, a pressed ghost): fills
  // where web draws a border.
  "surface-raised": lightVeil(0.075),
  "neutral-soft": lightVeil(0.06),
  // A sheet above the grey page.
  card: white,
  // The gold as text or an icon on a light page: the landing's
  // `--landing-ink` and the flyer's gold text.
  "accent-text": oklchToHex(lightInk),
  // ui/button outline: fazole has no outline; it is the neutral fill.
  "button-outline": lightVeil(0.06),
  "button-outline-pressed": lightVeil(0.105),
  // ui/button ghost: pressed, the neutral fill
  "button-ghost-pressed": lightVeil(0.06),
  // ui/button and ui/badge destructive: `bg-destructive/10`, button `hover:bg-destructive/20`
  "destructive-tint": colors["destructive-10"],
  "destructive-tint-pressed": colors["destructive-20"],
  // ui/input: fazole's filled field, `neutralSoft`; disabled dims it
  "input-bg": lightVeil(0.06),
  "input-disabled": lightVeil(0.06),
  // ui/switch: `data-unchecked:bg-input`, thumb `bg-background` — white, as
  // the grey page would dull it
  "switch-track-off": colors.input,
  "switch-thumb-on": white,
  "switch-thumb-off": white,
  // ui/tabs trigger: `text-foreground/60`; the active one is the accent pill
  "tabs-trigger": colors["foreground-60"],
  // The empty part of a chart's bar, a heatmap cell or a stepper's line:
  // web's `bg-muted`, which on a light page is paler than the card it sits on.
  track: lightVeil(0.085),
  // A block that is not a `Card` (a table tile, a panel on the page) and
  // its tints, laid on white.
  tile: white,
  "tile-primary-10": opaqueOver(lightAccent["primary-10"], white),
  "tile-primary-15": opaqueOver(lightAccent["primary-15"], white),
  "tile-info-10": opaqueOver(colors["info-10"], white),
  "tile-accent": opaqueOver(lightAccent.accent, white),
  // The menu's fill, the bottom tab bar (a block like Linky's `TabBar` on
  // `surface`) and the wide window's rail alike.
  "nav-bar": white,
})

/**
 * The dark page, a step below web's `.dark` background (`#101214`, L 0.18),
 * so the blocks on it stand further off: the fills keep their shade and only
 * the page sinks. Not black: an OLED smears pure black when the page scrolls.
 * `app.config.ts`'s dark splash and `public/index.html` paint the same color
 * before the app does (`themes.test.ts`).
 */
const darkPage = { l: 0.15, c: 0.005, h: 248 } as const

/** Each mode's page and the overlays derived from it, over web's. */
const pageColors = (page: { l: number; c: number; h: number }) =>
  ({
    background: oklchToHex({ ...page, alpha: 1 }),
    "background-60": oklchToHex({ ...page, alpha: 0.6 }),
    "background-70": oklchToHex({ ...page, alpha: 0.7 }),
  }) as const satisfies Partial<Record<keyof Palette, string>>

/**
 * The dark page's fills: one veil of the light ink over the background, in
 * light's order — `card` < `neutral-soft` < `surface-raised` < pressed — so a
 * secondary button stays louder than a field, as on a light page. The steps
 * are well over light's, more than Linky's dark theme takes: on a phone a
 * dark page loses its near-black differences to glass glare and low
 * brightness. The alphas are set over `darkPage`; a darker page needs
 * stronger veils for the same shade.
 */
const darkVeil = (alpha: number) =>
  oklchToHex({ l: 0.95, c: 0.005, h: 260, alpha })

const darkTones = (colors: Palette): Tones => ({
  "surface-raised": darkVeil(0.13),
  "neutral-soft": darkVeil(0.105),
  card: darkVeil(0.085),
  "accent-text": oklchToHex({ l: 0.86, c: 0.15, h: 88, alpha: 1 }),
  "button-outline": darkVeil(0.105),
  "button-outline-pressed": darkVeil(0.165),
  "button-ghost-pressed": darkVeil(0.105),
  // `dark:bg-destructive/20 dark:hover:bg-destructive/30`
  "destructive-tint": colors["destructive-20"],
  "destructive-tint-pressed": colors["destructive-30"],
  "input-bg": darkVeil(0.105),
  "input-disabled": colors["input-80"],
  // `dark:data-unchecked:bg-input/80`, thumb `dark:data-checked:bg-primary-foreground
  // dark:data-unchecked:bg-foreground`
  "switch-track-off": colors["input-80"],
  "switch-thumb-on": colors["primary-foreground"],
  "switch-thumb-off": colors.foreground,
  // `dark:bg-input/30`
  // `dark:text-muted-foreground`
  "tabs-trigger": colors["muted-foreground"],
  track: colors.muted,
  tile: darkVeil(0.105),
  "tile-primary-10": darkAccent["primary-10"],
  "tile-primary-15": darkAccent["primary-15"],
  "tile-info-10": colors["info-10"],
  "tile-accent": darkAccent.accent,
  "nav-bar": darkVeil(0.13),
})

/**
 * Finito's accent: the gold of the logo's rim, as finito.fit's landing
 * (`apps/landing/src/features/landing/landing.css`, `.landing`) and the
 * printed flyer draw their buttons, the same oklch values. It replaces web's
 * orange `primary` and everything derived from it; `palette.ts` keeps web's
 * palette for the `palette.test.ts` derivation, and the override is applied
 * here.
 *
 * Both pages take the same yellow under the same dark ink (10:1), as the
 * landing does: a gold deep enough to carry a white label turns brown. Where
 * the gold itself is the text or an icon on a light page it deepens to
 * `lightInk`, a mustard that holds its hue (3.1:1 on white, the flyer's gold
 * text) — for large or bold type and icons, never for running text.
 */
const gold = { l: 0.83, c: 0.16, h: 88, alpha: 1 } as const
const lightInk = { l: 0.66, c: 0.14, h: 88, alpha: 1 } as const

const brandAccent = (
  tone: typeof gold,
  foreground: { l: number; c: number; h: number }
) =>
  ({
    primary: oklchToHex(tone),
    "primary-foreground": oklchToHex({ ...foreground, alpha: 1 }),
    ring: oklchToHex(tone),
    accent: oklchToHex({ ...tone, alpha: 0.14 }),
    "primary-pressed": oklchToHex({ ...tone, alpha: 0.8 }),
    "primary-5": oklchToHex({ ...tone, alpha: 0.05 }),
    "primary-10": oklchToHex({ ...tone, alpha: 0.1 }),
    "primary-15": oklchToHex({ ...tone, alpha: 0.15 }),
    "primary-20": oklchToHex({ ...tone, alpha: 0.2 }),
    "primary-30": oklchToHex({ ...tone, alpha: 0.3 }),
    "primary-foreground-70": oklchToHex({ ...foreground, alpha: 0.7 }),
  }) as const satisfies Partial<Record<keyof Palette, string>>

const goldInk = { l: 0.22, c: 0.02, h: 80 } as const
const lightAccent = brandAccent(gold, goldInk)
const darkAccent = brandAccent(gold, goldInk)

/**
 * Finito's statistics read in the gold alone: one ramp of it for every
 * series, from the full accent to its palest tint, so a chart carries no
 * second hue. Light pages lead a step deeper than the accent, which is a
 * little pale to lead on white, and dark pages run down from it; both keep
 * the accent's hue, so no series turns brown.
 */
const goldRamp = (mode: "light" | "dark") => {
  const lightness =
    mode === "light"
      ? [0.72, 0.79, 0.85, 0.89, 0.92, 0.95]
      : [0.83, 0.74, 0.65, 0.56, 0.47, 0.39]
  const chroma =
    mode === "light"
      ? [0.15, 0.16, 0.15, 0.12, 0.09, 0.06]
      : [0.16, 0.15, 0.14, 0.12, 0.1, 0.08]
  return Object.fromEntries(
    lightness.map((l, index) => [
      `chart-${index + 1}`,
      oklchToHex({ l, c: chroma[index] ?? 0.1, h: gold.h, alpha: 1 }),
    ])
  ) as Record<`chart-${1 | 2 | 3 | 4 | 5 | 6}`, string>
}

/**
 * The web palette as Tamagui theme keys, with Finito's gold over its
 * primary and its own pages. Tamagui `Text` reads `color`, so
 * `foreground` is exposed under both names; `border` would clash with the
 * shorthand, so it becomes `border-color`.
 */
const appTheme = (
  { foreground, border, ...colors }: Palette,
  tones: Tones,
  mode: "light" | "dark"
) => ({
  ...colors,
  ...(mode === "dark"
    ? pageColors(darkPage)
    : { ...pageColors(lightPage), ...lightSurfaces }),
  ...(mode === "dark" ? darkAccent : lightAccent),
  ...goldRamp(mode),
  foreground,
  color: foreground,
  "border-color": border,
  ...tones,
})

export const appThemes = {
  light: appTheme(palette.light, lightTones(palette.light), "light"),
  dark: appTheme(palette.dark, darkTones(palette.dark), "dark"),
}

/** A theme key a native color prop accepts. */
export type ThemeColor = keyof (typeof appThemes)["dark"]
