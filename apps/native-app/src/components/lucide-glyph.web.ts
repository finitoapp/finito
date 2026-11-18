import { createNanoIconSet } from "react-native-nano-icons"
import glyphMap from "../../assets/icons/nanoicons/lucide.glyphmap.json"

/**
 * The PWA's half of `lucide-glyph.ts`: the same glyphs, from the `.woff2`
 * the config plugin builds beside the `.ttf`. On web, react-native-nano-icons
 * 1.0.1 loads no font itself and draws in the family named without the
 * build hash (`lucide`), so the face goes into the page's head under that
 * name, as `platform/web-styles.web.ts` adds Manrope's. `block` keeps an
 * icon blank, not a missing-glyph box, until the file arrives.
 */
const fontFile: unknown = require("../../assets/icons/nanoicons/lucide.woff2")

const style = document.createElement("style")
style.textContent = `
@font-face {
  font-family: '${glyphMap.m.f.replace(/-[0-9a-f]{8}$/u, "")}';
  font-display: block;
  src: url(${String(fontFile)}) format('woff2');
}`
document.head.append(style)

export const LucideGlyph = createNanoIconSet(glyphMap)

export type LucideGlyphName = keyof typeof glyphMap.i
