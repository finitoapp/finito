import { createNanoIconSet } from "react-native-nano-icons"
import glyphMap from "../../assets/icons/nanoicons/lucide.glyphmap.json"

/**
 * Lucide icons drawn from a font, for screens that draw many at once:
 * Settings draws ~20 rows, each an icon and a chevron. A
 * `lucide-react-native` icon is an SVG view tree (`Svg`, its group, a view
 * per shape) that it rebuilds in JS on every render; a glyph is one native
 * view drawing one character. On a PAX A920Pro, switching to Settings took
 * 1035 ms with lucide's icons, 950 ms with them written out as one SVG path
 * each, 836 ms with glyphs and 810 ms with no icons at all (2026-11-18).
 *
 * The font is built by `react-native-nano-icons`' config plugin at prebuild
 * from `assets/icons/lucide/<name>.svg`, each a symlink to the icon in
 * `lucide-static`, at the version of `lucide-react-native` (and of web's
 * `lucide-react`); their strokes are outlined at build time, so a glyph
 * keeps lucide's stroke width of 2. Add an icon with
 * `ln -s ../../../node_modules/lucide-static/icons/<name>.svg` in that folder
 * and `expo prebuild`, which `lucide-glyph.test.ts` checks; elsewhere the
 * lucide icon is fine.
 *
 * Pass `allowFontScaling={false}`, as an SVG icon ignores the font scale.
 */
export const LucideGlyph = createNanoIconSet(glyphMap)

export type LucideGlyphName = keyof typeof glyphMap.i
