/**
 * The web app's Tailwind scales the native ui kit uses, in px. Spacing has no
 * token scale: Tailwind's 4 px step is written out as numbers (`p-4` → 16),
 * and each ui component's doc comment lists the classes it mirrors.
 */

/** `--radius: 0.55rem` with `rounded-sm/md/lg/xl`, plus Tailwind's fixed radii. */
export const radius = {
  xs: 2,
  sm: 4.8,
  md: 6.8,
  lg: 8.8,
  xl: 12.8,
  "2xl": 16,
  "4xl": 32,
  full: 9999,
} as const

/**
 * fazole.fit's shapes (Linky's `packages/ui/src/tokens.ts`), which the kit
 * draws since Finito took Fazole's look: a control is 12 round, a card 16, a
 * sheet 24, a chip or an icon button a pill. Nothing has a border; surfaces
 * separate by fill alone.
 */
export const shape = {
  control: 12,
  card: 16,
  sheet: 24,
  pill: 9999,
} as const

/**
 * fazole.fit's control heights: `sm` 32 for a chip or a small action, `md`
 * 44 for a field or a button (a finger's target), `lg` 56 for a screen's
 * main action.
 */
export const control = {
  sm: 32,
  md: 44,
  lg: 56,
} as const

/**
 * `text-xs` … `text-3xl`: the body font's tokens, whose size and line height
 * are Tailwind's (`sm` 14/20, `xs` 12/16). Tamagui takes a line height from
 * the font only when asked, so set both, as web's `text-*` does:
 * `fontSize={fontSize.sm} lineHeight={fontSize.sm}`. Never a numeric
 * `lineHeight` (Tamagui reads it as a size token).
 */
export const fontSize = {
  xs: "xs",
  sm: "sm",
  base: "base",
  lg: "lg",
  xl: "xl",
  "2xl": "2xl",
  "3xl": "3xl",
} as const

/**
 * `font-normal`/`medium`/`semibold`/`bold` on Manrope's three faces, as
 * Linky's (`regular`, `semibold`, `bold`): `medium` is the semibold face,
 * the only weights the app bundles.
 */
export const fontWeight = {
  normal: "400",
  medium: "600",
  semibold: "600",
  bold: "700",
} as const

/** `max-w-md`/`max-w-xl`: the column web lays its screens out in on a wide window. */
export const maxWidth = {
  md: 448,
  xl: 576,
} as const
