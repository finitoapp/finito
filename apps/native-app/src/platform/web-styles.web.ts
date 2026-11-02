/**
 * Inter for the PWA, which the APK carries as one face per weight
 * (app.config.ts): fontsource's variable Inter, weights 100-900 in one file
 * per script, as its `wght.css` declares them. Metro's CSS cannot load the
 * files that stylesheet points at, so the faces go into the page's head
 * with the files required as Metro assets. Only Latin and Latin Extended,
 * which the app's languages need; `unicode-range` has the browser fetch the
 * extended file only for a page that uses it. `tamagui.config.ts` names the
 * family.
 */
const interFaces: ReadonlyArray<{
  readonly file: unknown
  readonly unicodeRange: string
}> = [
  {
    file: require("@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2"),
    unicodeRange:
      "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  },
  {
    file: require("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"),
    unicodeRange:
      "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  },
]

const fontFaces = interFaces
  .map(
    ({ file, unicodeRange }) => `
@font-face {
  font-family: 'Inter Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url(${String(file)}) format('woff2-variations');
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
const style = document.createElement("style")
style.textContent = `${fontFaces}
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--input); border-radius: 5px; }
* { scrollbar-width: thin; scrollbar-color: var(--input) transparent; }
`
document.head.append(style)
