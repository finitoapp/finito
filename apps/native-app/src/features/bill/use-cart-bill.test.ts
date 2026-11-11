import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8")

const expectInOrder = (source: string, ...patterns: ReadonlyArray<RegExp>) => {
  let remainder = source
  for (const pattern of patterns) {
    const match = remainder.match(pattern)
    expect(match, `missing ${pattern}`).not.toBeNull()
    if (match === null) return
    if (match.index === undefined) throw new Error(`no index for ${pattern}`)
    remainder = remainder.slice(match.index + match[0].length)
  }
}

/** One of the hook's own functions, up to the next one it declares. */
const hookFunction = (hook: string, name: string): string => {
  const start = hook.indexOf(`\n  const ${name} = `)
  expect(start, `missing ${name}`).toBeGreaterThan(-1)
  const end = hook.indexOf("\n  const ", start + 1)
  return hook.slice(start, end === -1 ? undefined : end)
}

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
