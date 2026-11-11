import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

const hook = readFileSync(
  new URL("./use-finish-bill.ts", import.meta.url),
  "utf8"
)

// As web's: what the cart offers is `deriveBillCheckout`'s
// (bill-checkout.test.ts) and finishing a bill at zero is in web's
// `bill.spec.ts`; this holds Finish to asking for `sell` before it writes,
// as `withdraw-access.test.ts` holds the PIN.
test("Finish asks for sell before it closes the bill", () => {
  const permission = hook.search(
    /if \(!\(await require\("sell", "access\.action\.finishBill"\)\)\) return/
  )
  const close = hook.search(/await run\(closeZeroBill\(billId\)\)/)
  expect(permission).toBeGreaterThan(-1)
  expect(close).toBeGreaterThan(permission)
})
