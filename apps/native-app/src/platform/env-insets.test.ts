import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"
import { insetsFromPadding, sameInsets } from "./env-insets.ts"

const indexHtml = readFileSync(
  path.resolve(import.meta.dirname, "../../public/index.html"),
  "utf8"
)

test("an installed PWA is as tall as the screen, not 100% plus the top inset", () => {
  // 100% plus the top inset overshot every iOS without WebKit 301108 and cut
  // the menu bar off; lvh is the whole screen with the bug and without.
  expect(indexHtml).not.toContain("calc(100% + env(safe-area-inset-top))")
  expect(indexHtml).toMatch(
    /html\.standalone,\s*html\.standalone body \{\s*height: 100lvh;/
  )
  // Set by script too: iOS does not always match `display-mode: standalone`.
  expect(indexHtml).toContain("navigator.standalone === true")
  expect(indexHtml).toContain('classList.add("standalone")')
})

test("reads the insets a probe padded by env() computes to", () => {
  expect(
    insetsFromPadding({
      paddingTop: "59px",
      paddingRight: "0px",
      paddingBottom: "34px",
      paddingLeft: "",
    })
  ).toEqual({ top: 59, right: 0, bottom: 34, left: 0 })
  expect(
    insetsFromPadding({
      paddingTop: "20.5px",
      paddingRight: "auto",
      paddingBottom: "-3px",
      paddingLeft: "47px",
    })
  ).toEqual({ top: 20.5, right: 0, bottom: 0, left: 47 })
})

test("compares insets edge by edge", () => {
  const insets = { top: 20, right: 0, bottom: 0, left: 0 }
  expect(sameInsets(insets, { ...insets })).toBe(true)
  expect(sameInsets(insets, { ...insets, bottom: 34 })).toBe(false)
})
