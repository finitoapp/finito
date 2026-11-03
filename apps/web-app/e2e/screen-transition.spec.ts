import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { menuHome, openMenuTab } from "./support/navigation.ts"

/**
 * The direction is the part that silently breaks: get it wrong and back looks
 * like forward. This records the view-transition types the router asks for.
 */
declare global {
  interface Window {
    __viewTransitionTypes?: Array<string>
  }
}

// The suite runs with reduced motion, which switches the animation off.
test.use({ reducedMotion: "no-preference" })

test("pushes and pops inside a stack transition, the money path does not", async ({
  seededPage: page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.evaluate(() => {
    const types: Array<string> = []
    window.__viewTransitionTypes = types
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = (update) => {
      types.push(
        typeof update === "function"
          ? "untyped"
          : [...(update?.types ?? [])].join(",")
      )
      return start(update)
    }
  })

  const button = (key: Parameters<typeof translate>[1]) =>
    page.getByRole("button", { name: translate("en", key) })
  const heading = (key: Parameters<typeof translate>[1]) =>
    page.getByRole("heading", { name: translate("en", key) })

  // Into the menu, across to another tab, one level down, and back out.
  await button("nav.menu").click()
  await expect(heading("activity.title")).toBeVisible()

  // A tab switch moves between stacks, an instant swap.
  await openMenuTab(page, "en", "nav.settings")
  await expect(heading("settings.title")).toBeVisible()

  await page
    .getByRole("link", {
      name: new RegExp(`^${translate("en", "settings.language.title")}\\b`),
    })
    .click()
  await expect(heading("settings.language.title")).toBeVisible()

  await page.goBack()
  await expect(heading("settings.title")).toBeVisible()

  // Home pops the section back to home.
  await menuHome(page, "en").click()
  await expect(button("nav.menu")).toBeVisible()

  // The money path is deliberately left out: opening a bill stays an instant
  // swap, leaving the recorded types untouched.
  const switchToPos = button("nav.pos")
  if (await switchToPos.isVisible()) {
    await switchToPos.click()
  }
  await page
    .getByTestId("no-table-tile")
    .getByRole("link", { name: translate("en", "tables.tile.newBill") })
    .click()
  await expect(heading("bill.title")).toBeVisible()

  expect(await page.evaluate(() => window.__viewTransitionTypes)).toEqual([
    "forward",
    "forward",
    "backward",
    "backward",
  ])
})
