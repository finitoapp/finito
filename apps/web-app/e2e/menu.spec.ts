import type { Page } from "@playwright/test"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import {
  type MenuTabLabelKey,
  menuButton,
  menuHome,
  openMenuTab,
} from "./support/navigation.ts"

const menuNav = (page: Page) =>
  page.getByRole("navigation", { name: translate("en", "nav.menu") })

const heading = (page: Page, key: Parameters<typeof translate>[1]) =>
  page.getByRole("heading", { name: translate("en", key), exact: true })

const backButton = (page: Page) =>
  page.getByRole("button", { name: translate("en", "nav.back") })

/** Each tab of the menu section and the heading its root screen shows. */
const tabs = [
  ["nav.catalog", "catalog.items.title"],
  ["nav.settings", "settings.title"],
  ["nav.activity", "activity.title"],
] as const satisfies ReadonlyArray<
  readonly [MenuTabLabelKey, Parameters<typeof translate>[1]]
>

test("the hamburger opens Activity, every tab switches, and Home returns home", async ({
  seededPage: page,
}) => {
  await test.step("the hamburger opens Activity, with the bar", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await menuButton(page, "en").click()
    await expect(heading(page, "activity.title")).toBeVisible()
    await expect(menuNav(page)).toBeVisible()
    await expect(
      menuNav(page).getByRole("link", {
        name: translate("en", "nav.activity"),
        exact: true,
      })
    ).toHaveAttribute("aria-current", "page")
  })

  await test.step("every tab can be switched to", async () => {
    for (const [labelKey, headingKey] of tabs) {
      await openMenuTab(page, "en", labelKey)
      await expect(heading(page, headingKey)).toBeVisible()
      await expect(
        menuNav(page).getByRole("link", {
          name: translate("en", labelKey),
          exact: true,
        })
      ).toHaveAttribute("aria-current", "page")
    }
  })

  await test.step("a root screen has no Back, and Home returns home, the tab switches not rewound", async () => {
    await expect(backButton(page)).toHaveCount(0)
    await menuHome(page, "en").click()
    await expect(menuButton(page, "en")).toBeVisible()
  })
})

test("the bar is hidden on a sub-screen, which has Back instead", async ({
  seededPage: page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await menuButton(page, "en").click()
  await openMenuTab(page, "en", "nav.settings")
  await expect(heading(page, "settings.title")).toBeVisible()

  await test.step("Settings › Language has no bar", async () => {
    await page
      .getByRole("link", {
        name: new RegExp(`^${translate("en", "settings.language.title")}\\b`),
      })
      .click()
    await expect(heading(page, "settings.language.title")).toBeVisible()
    await expect(menuNav(page)).toHaveCount(0)
    await expect(menuHome(page, "en")).toHaveCount(0)
  })

  await test.step("Back returns to the root screen and its bar", async () => {
    await page
      .getByRole("button", { name: translate("en", "nav.back") })
      .click()
    await expect(heading(page, "settings.title")).toBeVisible()
    await expect(menuNav(page)).toBeVisible()
  })
})

test("Home on a root screen opened by URL goes home", async ({
  seededPage: page,
}) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" })
  await expect(heading(page, "settings.title")).toBeVisible()
  await menuHome(page, "en").click()
  await expect(menuButton(page, "en")).toBeVisible()
  await expect(page).toHaveURL("/")
})

test("a large monitor shows the sidebar on every screen of the section", async ({
  seededPage: page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/settings/language", { waitUntil: "domcontentloaded" })
  await expect(heading(page, "settings.language.title")).toBeVisible()
  await expect(menuNav(page)).toBeVisible()

  await openMenuTab(page, "en", "nav.catalog")
  await expect(heading(page, "catalog.items.title")).toBeVisible()
})

test("the bell on home opens Notifications, which has Back and no bar", async ({
  seededPage: page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page
    .getByRole("button", { name: translate("en", "nav.notifications") })
    .click()
  await expect(heading(page, "notifications.title")).toBeVisible()
  await expect(menuNav(page)).toHaveCount(0)
  await backButton(page).click()
  await expect(menuButton(page, "en")).toBeVisible()
})
