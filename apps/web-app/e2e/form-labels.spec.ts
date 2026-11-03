import { expect, test } from "./support/fixtures.ts"

/**
 * Every form builds its control ids from one `useId()` per form plus a
 * per-field suffix (`` `${formId}-name` ``). That pairing lives in two
 * template strings — the label's `htmlFor` and the control's `id` — so a
 * mistyped suffix detaches the label with nothing to catch it: the page
 * still renders, and only the accessible name silently disappears.
 *
 * This walks every form screen and checks each `label[for]` resolves to a
 * control that exists, and that no id is claimed twice.
 */
const formPaths = [
  "/catalog/items/new",
  "/catalog/tables/new",
  "/settings/tax-rates",
  "/settings/payment-accounts/iban",
  "/settings/payment-accounts/iban/fio-plugin",
  "/settings/payment-number-series",
  "/settings/legal-entity",
  "/settings/tips",
]

test("every form label points at a control that exists", async ({
  seededPage: page,
}) => {
  for (const path of formPaths) {
    await test.step(path, async () => {
      await page.goto(path, { waitUntil: "domcontentloaded" })
      await page.locator("label").first().waitFor()

      const report = await page.evaluate(() => {
        const labelled = [...document.querySelectorAll("label[for]")]
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id)
        return {
          labelCount: labelled.length,
          dangling: labelled
            .map((label) => label.getAttribute("for") ?? "")
            .filter((id) => document.getElementById(id) === null),
          duplicated: ids.filter((id, index) => ids.indexOf(id) !== index),
        }
      })

      expect(report.labelCount).toBeGreaterThan(0)
      expect(report.dangling).toEqual([])
      expect(report.duplicated).toEqual([])
    })
  }
})
