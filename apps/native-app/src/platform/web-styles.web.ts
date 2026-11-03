/**
 * Manrope for the PWA, which the APK carries as one face per weight
 * (app.config.ts): Google Fonts' static faces from Fontsource
 * (`@fontsource/manrope`, OFL, the files the landing loads), regular,
 * semibold and bold, one file per script. Metro's CSS cannot load the
 * files a stylesheet points at, so the faces go into the page's head with
 * the files required as Metro assets. Only Latin and Latin Extended, which
 * the app's languages need; `unicode-range` has the browser fetch the
 * extended file only for a page that uses it. `tamagui.config.ts` names the
 * family.
 */
const latinExtRange =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
const latinRange =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"

const manropeFaces: ReadonlyArray<{
  readonly file: unknown
  readonly weight: number
  readonly unicodeRange: string
}> = [
  {
    file: require("@fontsource/manrope/files/manrope-latin-ext-400-normal.woff2"),
    weight: 400,
    unicodeRange: latinExtRange,
  },
  {
    file: require("@fontsource/manrope/files/manrope-latin-400-normal.woff2"),
    weight: 400,
    unicodeRange: latinRange,
  },
  {
    file: require("@fontsource/manrope/files/manrope-latin-ext-600-normal.woff2"),
    weight: 600,
    unicodeRange: latinExtRange,
  },
  {
    file: require("@fontsource/manrope/files/manrope-latin-600-normal.woff2"),
    weight: 600,
    unicodeRange: latinRange,
  },
  {
    file: require("@fontsource/manrope/files/manrope-latin-ext-700-normal.woff2"),
    weight: 700,
    unicodeRange: latinExtRange,
  },
  {
    file: require("@fontsource/manrope/files/manrope-latin-700-normal.woff2"),
    weight: 700,
    unicodeRange: latinRange,
  },
]

const fontFaces = manropeFaces
  .map(
    ({ file, weight, unicodeRange }) => `
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url(${String(file)}) format('woff2');
  unicode-range: ${unicodeRange};
}`
  )
  .join("")

/**
 * The scrollbar of web-app's `index.css` ("Custom Scrollbar"): thin, on a
 * transparent track, in the theme's `input` color, which Tamagui exposes as
 * `--input` for the active light or dark theme. React Native has no style
 * for a scrollbar, so the rules go into the page's head.
 */
/**
 * react-native-web renders a `Pressable` with `role="button"` as a
 * `<button>`, whose user-agent styles centre its text and draw it in the
 * system font and `buttontext` color. Text inside inherits them, so a
 * pressable list row would centre its secondary line. Reset them as
 * web-app's Tailwind preflight does, and the text alignment too, which web
 * never meets because its rows are links.
 */
const buttonReset = `
button { font: inherit; letter-spacing: inherit; color: inherit; text-align: inherit; }
`

/**
 * React Native's `Modal` renders its content in a portal beside the app's
 * root, outside the element Tamagui sets the body font on, so a dialog fell
 * back to the browser's serif. The page itself names the family.
 */
const bodyFont = `
body { font-family: Manrope, sans-serif; }
`

const style = document.createElement("style")
style.textContent = `${fontFaces}${bodyFont}${buttonReset}
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--input); border-radius: 5px; }
* { scrollbar-width: thin; scrollbar-color: var(--input) transparent; }
`
document.head.append(style)
