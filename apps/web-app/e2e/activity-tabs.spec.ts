import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"

declare global {
  interface Window {
    __activityTabTransitions?: number
  }
}

// The suite runs with reduced motion; the indicator's slide and the screen
// transition this guards against only run without it.
test.use({ reducedMotion: "no-preference" })

test("Activity's tabs stay in place and only their indicator moves", async ({
  seededPage: page,
}) => {
  await gotoPage(page, "/activity", "en", "activity.title")

  const tablist = page.getByRole("tablist")
  const tab = (key: Parameters<typeof translate>[1]) =>
    page.getByRole("tab", { name: translate("en", key) })

  await test.step("mark the tabs and count screen transitions", async () => {
    await tablist.evaluate((element) => {
      element.setAttribute("data-e2e-kept", "")
    })
    await page.evaluate(() => {
      window.__activityTabTransitions = 0
      const start = document.startViewTransition.bind(document)
      document.startViewTransition = (update) => {
        window.__activityTabTransitions =
          (window.__activityTabTransitions ?? 0) + 1
        return start(update)
      }
    })
  })

  const top = await tablist.evaluate(
    (element) => element.getBoundingClientRect().top
  )

  for (const [key, path] of [
    ["activity.tabs.bills", "/activity/bills"],
    ["activity.tabs.stats", "/activity/stats"],
    ["activity.tabs.payments", "/activity"],
  ] as const) {
    await test.step(`switch to ${path}`, async () => {
      await tab(key).click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(tab(key)).toHaveAttribute("aria-selected", "true")
      // The same tabs, not a new copy drawn by the next screen, at the
      // same height, with the indicator under the selected tab.
      await expect(tablist).toHaveAttribute("data-e2e-kept", "")
      expect(
        await tablist.evaluate((element) => element.getBoundingClientRect().top)
      ).toBe(top)
      await expect
        .poll(() =>
          page.evaluate(
            (name) => {
              const indicator = document.querySelector(
                '[role="tablist"] > span'
              )
              const selected = [
                ...document.querySelectorAll('[role="tab"]'),
              ].find((element) => element.textContent === name)
              if (indicator === null || selected === undefined) return null
              const a = indicator.getBoundingClientRect()
              const b = selected.getBoundingClientRect()
              return (
                Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1
              )
            },
            translate("en", key)
          )
        )
        .toBe(true)
    })
  }

  expect(await page.evaluate(() => window.__activityTabTransitions)).toBe(0)
})
