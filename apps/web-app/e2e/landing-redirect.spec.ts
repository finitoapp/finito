import type { Page } from "@playwright/test"
import { expect, test } from "./support/fixtures.ts"

import { translate } from "./support/i18n.ts"

/** The download section's button that opens the web app. */
const webAppLink = (page: Page, language: "cs" | "en" | "sk") =>
  page.locator("#download").getByRole("link", {
    name: translate(language, "landing.cta.startShort"),
    exact: true,
  })

/** Makes the page see an Android phone (landing/0016). */
const pretendAndroid = `
  Object.defineProperty(navigator, "userAgent", {
    get: () => "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
  })
`

test("a new browser visitor lands on the landing page until they open the app", async ({
  page,
}) => {
  await test.step("the app's address shows the Czech landing page, whatever the browser's language", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL("/landing")
  })

  await test.step("the landing page opens onboarding", async () => {
    await webAppLink(page, "cs").click()
    await expect(
      page.getByRole("heading", { name: translate("cs", "onboarding.title") })
    ).toBeVisible()
  })

  await test.step("the app's address now goes to onboarding", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL("/onboarding")
  })
})

test("an installed PWA without an account goes straight to onboarding", async ({
  page,
}) => {
  await page.addInitScript({
    content: `
      const matchMedia = window.matchMedia.bind(window)
      window.matchMedia = (query) =>
        query === "(display-mode: standalone)"
          ? { matches: true, media: query }
          : matchMedia(query)
    `,
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL("/onboarding")
})

test("switching the landing page's language moves to that language's page", async ({
  page,
}) => {
  await page.goto("/landing/en", { waitUntil: "domcontentloaded" })
  await page
    .getByRole("button", { name: translate("en", "landing.language.label") })
    .click()
  await page.getByRole("menuitemradio", { name: "Čeština" }).click()

  await expect(page).toHaveURL("/landing")
  await expect(
    page.getByRole("heading", { name: translate("cs", "landing.faq.title") })
  ).toBeVisible()

  await test.step("and the app's address remembers it", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL("/landing")
  })
})

test("the app starts in the language of the landing page it was opened from", async ({
  page,
}) => {
  await page.goto("/landing", { waitUntil: "domcontentloaded" })
  await webAppLink(page, "cs").click()

  await expect(
    page.getByRole("heading", { name: translate("cs", "onboarding.title") })
  ).toBeVisible()
  await expect(page).toHaveURL("/onboarding")

  await test.step("and keeps it on the app's address", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { name: translate("cs", "onboarding.title") })
    ).toBeVisible()
  })
})

test("a device with an account keeps its language when opened from the landing page", async ({
  seededPage: page,
}) => {
  await page.goto("/landing", { waitUntil: "domcontentloaded" })
  await webAppLink(page, "cs").click()

  await expect(page).toHaveURL("/")
  await expect(
    page.getByRole("button", { name: translate("en", "nav.menu") })
  ).toBeVisible()
})

const pretendInstalled = `
  const matchMedia = window.matchMedia.bind(window)
  window.matchMedia = (query) =>
    query === "(display-mode: standalone)"
      ? { matches: true, media: query }
      : matchMedia(query)
`

test("an app installed from the landing page starts in the page's language", async ({
  page,
}) => {
  await page.goto("/landing/sk", { waitUntil: "domcontentloaded" })

  await test.step("the browser installs the app from its own menu", async () => {
    // Retried until the page has hydrated and listens for the install.
    await expect(async () => {
      await page.evaluate(() => dispatchEvent(new Event("appinstalled")))
      expect(
        await page.evaluate(() => localStorage.getItem("payky.installLanguage"))
      ).toBe('"sk"')
    }).toPass()
  })

  await test.step("the installed app opens onboarding in Slovak", async () => {
    await page.addInitScript({ content: pretendInstalled })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { name: translate("sk", "onboarding.title") })
    ).toBeVisible()
  })
})

test("an installed app that starts on the landing page goes to onboarding in its language", async ({
  page,
}) => {
  await page.addInitScript({ content: pretendInstalled })
  await page.goto("/landing/sk", { waitUntil: "domcontentloaded" })

  await expect(
    page.getByRole("heading", { name: translate("sk", "onboarding.title") })
  ).toBeVisible()
})

test("the download section offers every way in, the web app first", async ({
  page,
}) => {
  await page.goto("/landing/en", { waitUntil: "domcontentloaded" })
  const download = page.locator("#download")

  await expect(webAppLink(page, "en")).toHaveAttribute(
    "href",
    "/onboarding?lang=en"
  )
  await expect(
    download.getByRole("link", {
      name: translate("en", "landing.closing.get.zapstore.label"),
    })
  ).toHaveAttribute("href", "https://zapstore.dev/apps/me.payky")
  await expect(
    download.getByRole("link", {
      name: translate("en", "landing.closing.get.apk.label"),
    })
  ).toHaveAttribute(
    "href",
    "https://github.com/finitoapp/finito/releases/latest/download/app-release-signed.apk"
  )
  await page
    .getByRole("link", { name: translate("en", "landing.cta.moreOptions") })
    .click()
  await expect(download).toBeInViewport()
})

test("on Android the main way in is the store", async ({ page }) => {
  await page.addInitScript({ content: pretendAndroid })
  await page.goto("/landing/en", { waitUntil: "domcontentloaded" })

  await expect(
    page.getByRole("banner").getByRole("link", {
      name: translate("en", "landing.cta.download"),
      exact: true,
    })
  ).toHaveAttribute("href", "https://zapstore.dev/apps/me.payky")
  await expect(
    page.getByRole("link", { name: translate("en", "landing.cta.start") })
  ).toHaveCount(0)
  await expect(page.locator("#download a").first()).toHaveText(
    translate("en", "landing.closing.get.zapstore.label")
  )
})

test("the landing page's start buttons open the app in its language", async ({
  page,
}) => {
  await page.goto("/landing/sk", { waitUntil: "domcontentloaded" })

  for (const [name, exact] of [
    [translate("sk", "landing.cta.start"), false],
    [translate("sk", "landing.cta.startShort"), true],
  ] as const) {
    for (const link of await page.getByRole("link", { name, exact }).all()) {
      await expect(link).toHaveAttribute("href", "/onboarding?lang=sk")
    }
  }

  await page
    .getByRole("link", { name: translate("sk", "landing.cta.start") })
    .click()
  await expect(
    page.getByRole("heading", { name: translate("sk", "onboarding.title") })
  ).toBeVisible()
})

test("the app origin serves the independent landing documents and assets", async ({
  request,
}) => {
  for (const language of ["", "/en", "/sk"]) {
    for (const document of ["", "/eet-2-0", "/jak-to-funguje", "/privacy"]) {
      const path = `/landing${language}${document}`
      const response = await request.get(path)
      expect(response.ok()).toBe(true)
      const html = await response.text()
      expect(response.headers()["content-type"]).toContain("text/html")
      expect(html).toContain('src="/landing/')
    }
  }

  const html = await (await request.get("/landing")).text()
  const assets = [
    ...html.matchAll(/(?:src|href)="(\/landing\/(?:assets|src)\/[^" ]+)"/gu),
  ]
  expect(assets.length).toBeGreaterThan(0)
  for (const asset of assets) {
    const response = await request.get(asset[1] ?? "")
    expect(response.ok(), asset[1]).toBe(true)
    expect(response.headers()["content-type"]).not.toContain("text/html")
  }
  for (const url of [
    "/landing/pwa-icon.svg",
    "http://127.0.0.1:5175/landing/pwa-icon.svg",
  ]) {
    const logo = await request.get(url)
    expect(logo.ok()).toBe(true)
    expect(logo.headers()["content-type"]).toContain("image/svg+xml")
    expect(await logo.text()).toContain("<svg")
  }
  const image = await request.get("/landing/og-cs.png")
  expect(image.ok()).toBe(true)
  expect(image.headers()["content-type"]).toContain("image/png")
  const sitemap = await request.get("/sitemap.xml")
  expect(sitemap.ok()).toBe(true)
  expect(await sitemap.text()).toContain(
    "https://payky.me/landing/sk/jak-to-funguje"
  )
  const manifest = await request.get("/manifest.webmanifest")
  expect(manifest.ok()).toBe(true)
  expect(await manifest.json()).toMatchObject({ start_url: "/" })
})

// The card terminal documentation is Finito's alone (landing/0015).
test("Payky's landing has no card terminal documentation", async ({
  page,
  request,
}) => {
  for (const path of [
    "/landing/terminal",
    "/landing/en/terminal",
    "/landing/sk/terminal",
  ]) {
    expect((await request.get(path)).ok(), path).toBe(false)
  }

  await page.goto("/landing/en", { waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("link", {
      name: translate("en", "landing.footer.privacy"),
    })
  ).toBeVisible()
  await expect(
    page.getByRole("link", {
      name: translate("en", "landing.footer.terminal"),
    })
  ).toHaveCount(0)
})

test("the independent landing submits contact to the app origin", async ({
  page,
}) => {
  const submitted = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/contact") && request.method() === "POST"
  )
  await page.route("**/api/contact", (route) =>
    route.fulfill({ json: { status: "OK" } })
  )
  await page.goto("/landing/en", { waitUntil: "domcontentloaded" })
  await page
    .getByLabel(translate("en", "landing.contact.email.label"), { exact: true })
    .fill("merchant@example.com")
  await page
    .getByRole("button", {
      name: translate("en", "landing.contact.submit"),
      exact: true,
    })
    .click()
  const request = await submitted
  expect(new URL(request.url()).origin).toBe(new URL(page.url()).origin)
  expect(request.postDataJSON()).toMatchObject({
    email: "merchant@example.com",
  })
  await expect(
    page.getByText(translate("en", "landing.contact.sent.title"), {
      exact: true,
    })
  ).toBeVisible()
})
