import { oklchToHex } from "./oklch.ts"
import { palette } from "./palette.ts"

type Palette = (typeof palette)["light" | "dark"]

type Tones = Record<
  | "surface-raised"
  | "neutral-soft"
  | "card"
  | "accent-text"
  | "button-outline"
  | "button-outline-border"
  | "button-outline-pressed"
  | "button-ghost-pressed"
  | "destructive-tint"
  | "destructive-tint-pressed"
  | "input-bg"
  | "input-disabled"
  | "switch-track-off"
  | "switch-thumb-on"
  | "switch-thumb-off"
  | "checkbox-bg"
  | "tabs-trigger"
  | "tabs-active"
  | "tabs-active-border",
  string
>

/**
 * Tones web picks with a `dark:` class, which a Tamagui variant cannot
 * express: each is one theme key with a light and a dark value. The first
 * two are fazole.fit's fills (`tokens.ts`'s `shape`), on web's palette.
 */
const lightTones = (colors: Palette): Tones => ({
  // fazole.fit's `surfaceRaised` (a secondary button, a list's raised tile)
  // and `neutralSoft` (a field, an outline button, a pressed ghost): fills
  // where web draws a border.
  // Quieter than Linky's solids, as fazole.fit draws them: a tint of the
  // ink over the page, so a section, a tab bar or a secondary button lifts
  // off the background without reading as a box.
  "surface-raised": oklchToHex({ l: 0.2, c: 0.02, h: 260, alpha: 0.05 }),
  "neutral-soft": colors["input-50"],
  card: oklchToHex({ l: 0.2, c: 0.02, h: 260, alpha: 0.03 }),
  // The gold as text or an icon on a light page: the landing's `--landing-ink`.
  "accent-text": oklchToHex({ l: 0.6, c: 0.13, h: 72, alpha: 1 }),
  // ui/button outline: fazole has no outline; it is the neutral fill.
  "button-outline": colors["input-50"],
  "button-outline-border": "transparent",
  "button-outline-pressed": colors.input,
  // ui/button ghost: pressed, the neutral fill
  "button-ghost-pressed": colors["input-50"],
  // ui/button and ui/badge destructive: `bg-destructive/10`, button `hover:bg-destructive/20`
  "destructive-tint": colors["destructive-10"],
  "destructive-tint-pressed": colors["destructive-20"],
  // ui/input: fazole's filled field, `neutralSoft`; disabled dims it
  "input-bg": colors["input-50"],
  "input-disabled": colors["input-50"],
  // ui/switch: `data-unchecked:bg-input`, thumb `bg-background`
  "switch-track-off": colors.input,
  "switch-thumb-on": colors.background,
  "switch-thumb-off": colors.background,
  // ui/checkbox: `bg-background`
  "checkbox-bg": colors.background,
  // ui/tabs trigger: `text-foreground/60`, active `bg-background`
  "tabs-trigger": colors["foreground-60"],
  "tabs-active": colors.background,
  "tabs-active-border": "transparent",
})

const darkTones = (colors: Palette): Tones => ({
  "surface-raised": oklchToHex({ l: 0.95, c: 0.005, h: 260, alpha: 0.055 }),
  "neutral-soft": colors["input-30"],
  card: oklchToHex({ l: 0.95, c: 0.005, h: 260, alpha: 0.035 }),
  "accent-text": oklchToHex({ l: 0.86, c: 0.15, h: 88, alpha: 1 }),
  "button-outline": colors["input-30"],
  "button-outline-border": "transparent",
  "button-outline-pressed": colors["input-50"],
  "button-ghost-pressed": colors["input-30"],
  // `dark:bg-destructive/20 dark:hover:bg-destructive/30`
  "destructive-tint": colors["destructive-20"],
  "destructive-tint-pressed": colors["destructive-30"],
  "input-bg": colors["input-30"],
  "input-disabled": colors["input-80"],
  // `dark:data-unchecked:bg-input/80`, thumb `dark:data-checked:bg-primary-foreground
  // dark:data-unchecked:bg-foreground`
  "switch-track-off": colors["input-80"],
  "switch-thumb-on": colors["primary-foreground"],
  "switch-thumb-off": colors.foreground,
  // `dark:bg-input/30`
  "checkbox-bg": colors["input-30"],
  // `dark:text-muted-foreground`, active `dark:border-input dark:bg-input/30`
  "tabs-trigger": colors["muted-foreground"],
  "tabs-active": colors["input-30"],
  "tabs-active-border": colors.input,
})

/**
 * Finito's accent: the gold of the logo's rim, as finito.fit's landing
 * (`apps/landing/src/features/landing/landing.css`, `.landing`) draws its
 * buttons, the same oklch values. It replaces web's orange `primary` and
 * everything derived from it; `palette.ts` keeps web's palette for the
 * `palette.test.ts` derivation, and the override is applied here.
 */
const gold = { l: 0.83, c: 0.16, h: 88, alpha: 1 } as const
const brandAccent = {
  primary: oklchToHex(gold),
  "primary-foreground": oklchToHex({ l: 0.22, c: 0.02, h: 80, alpha: 1 }),
  ring: oklchToHex(gold),
  accent: oklchToHex({ ...gold, alpha: 0.14 }),
  "primary-pressed": oklchToHex({ ...gold, alpha: 0.8 }),
  "primary-5": oklchToHex({ ...gold, alpha: 0.05 }),
  "primary-10": oklchToHex({ ...gold, alpha: 0.1 }),
  "primary-15": oklchToHex({ ...gold, alpha: 0.15 }),
  "primary-20": oklchToHex({ ...gold, alpha: 0.2 }),
  "primary-30": oklchToHex({ ...gold, alpha: 0.3 }),
  "primary-foreground-70": oklchToHex({ l: 0.22, c: 0.02, h: 80, alpha: 0.7 }),
} as const satisfies Partial<Record<keyof Palette, string>>

/**
 * Finito's statistics read in the gold alone: one ramp of it for every
 * series, from the full accent to its palest tint, so a chart carries no
 * second hue. Light pages take the deeper golds (the accent itself is too
 * pale on them), dark pages run down from the accent.
 */
const goldRamp = (mode: "light" | "dark") => {
  const lightness =
    mode === "light"
      ? [0.58, 0.66, 0.74, 0.81, 0.87, 0.92]
      : [0.83, 0.74, 0.65, 0.56, 0.47, 0.39]
  const chroma =
    mode === "light"
      ? [0.14, 0.14, 0.14, 0.13, 0.1, 0.07]
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
 * primary. Tamagui `Text` reads `color`, so `foreground` is exposed under
 * both names; `border` would clash with the shorthand, so it becomes
 * `border-color`.
 */
const appTheme = (
  { foreground, border, ...colors }: Palette,
  tones: Tones,
  mode: "light" | "dark"
) => ({
  ...colors,
  ...brandAccent,
  ...goldRamp(mode),
  foreground,
  color: foreground,
  "border-color": border,
  ...tones,
  // A selected segment (Activity's tabs, the payment method pill) is the
  // accent, as the menu bar's active pill: Linky's `TabBar`.
  "tabs-active": brandAccent.primary,
  "tabs-active-border": "transparent",
})

export const appThemes = {
  light: appTheme(palette.light, lightTones(palette.light), "light"),
  dark: appTheme(palette.dark, darkTones(palette.dark), "dark"),
}

/** A theme key a native color prop accepts. */
export type ThemeColor = keyof (typeof appThemes)["dark"]
