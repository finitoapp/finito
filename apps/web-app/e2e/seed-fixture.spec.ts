import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { seedCurrentAccountOnboarding } from "./support/onboarding.ts"

test("seeding survives the document being replaced mid-call", async ({
  page,
}) => {
  // F13: seen once as `page.evaluate: Execution context was destroyed, most
  // likely because of a navigation`, in an unrelated spec's first step. Too
  // rare to reproduce by waiting (once in 13+ runs of that spec), so the
  // destroyed context is caused here on purpose: the bridge call reloads the
  // document instead of returning, which is exactly the shape of the failure.
  await page.goto("/onboarding", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(
    () => typeof window.__e2eSeedOnboarding === "function"
  )
  await page.evaluate(() => {
    window.__e2eSeedOnboarding = () => {
      window.location.reload()
      // Never resolves: the context dies while the evaluate is in flight,
      // which is what Playwright reports rather than a rejected promise.
      return new Promise<void>(() => {})
    }
  })

  // The retry re-waits for the bridge in the fresh document, where the real
  // seed is back, so this resolves instead of failing the fixture.
  await seedCurrentAccountOnboarding(page, "en")

  await expect(
    page.getByRole("button", { name: translate("en", "nav.menu") })
  ).toBeVisible()
})
