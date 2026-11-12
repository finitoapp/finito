import { appThemes } from "../theme/themes.ts"

/**
 * Colors the PWA's system bar with the page the theme paints, the native
 * theme's `background` (not web's palette, which native's page departs
 * from). `index.html` ships one `theme-color` per `prefers-color-scheme`,
 * right before the bundle loads; once the app knows the theme, which the
 * device setting may force against the system scheme, a single
 * unconditional tag replaces them, so no media query can pick the other
 * scheme's color.
 */
export const setBrowserThemeColor = (theme: "light" | "dark"): void => {
  const tags = document.head.querySelectorAll('meta[name="theme-color"]')
  const [first, ...rest] = tags
  for (const tag of rest) tag.remove()
  const tag = first ?? document.createElement("meta")
  tag.setAttribute("name", "theme-color")
  tag.removeAttribute("media")
  tag.setAttribute("content", appThemes[theme].background)
  if (first === undefined) document.head.append(tag)
}
