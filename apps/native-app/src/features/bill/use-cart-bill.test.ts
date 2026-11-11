import { readFileSync } from "node:fs"
import { expectInOrder, hookFunction } from "@payky/core/testing/source-order"
import { test } from "vitest"

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8")

// As web's: the rule is `linesNeedDiscard`'s (cart-lines.test.ts); these hold
// the cart to asking it before every write that can carry a discount
// (access/0012), as `withdraw-access.test.ts` holds the PIN before a send.

test("a tap or a scan checks discard on the item's price before the bill row is created", () => {
  expectInOrder(
    hookFunction(read("use-cart-bill.ts"), "addQuantity"),
    /await mayWrite\(/,
    /await ensureBillExists\(\)/,
    /addCatalogItemToBill\(/
  )
})

test("removing, clearing, undo and redo check discard on the lines they write", () => {
  const hook = read("use-cart-bill.ts")
  expectInOrder(
    hookFunction(hook, "removeFromCart"),
    /await mayWrite\(/,
    /appendRemoveBillLine\(/
  )
  for (const name of ["clear", "undo", "redo"]) {
    expectInOrder(
      hookFunction(hook, name),
      /await mayWrite\(/,
      /appendGuardedBillLines\(/
    )
  }
})

test("a split that moves a discount asks for discard before it writes", () => {
  const hook = read("use-split-bill.ts")
  expectInOrder(
    hook,
    /await require\("discard", "access\.action\.moveDiscount"\)/,
    /splitBillIntoNewBill\(\{/
  )
})
