import { describe, expect, test } from "vitest"
import { settingsQuery } from "../modules/app-settings/app-settings-queries.ts"
import { billByIdQuery } from "../modules/bill/bill-queries.ts"
import { createRandomBillId } from "../modules/bill/bill-types.ts"
import { createEvoluTest } from "../testing/evolu.ts"

/**
 * The apps' `usePreloadEvoluQueries` starts a screen's queries before its
 * first `useEvoluQuery` suspends, and relies on Evolu handing that hook the
 * promise the preload started: for the same query, even one a builder makes
 * again on the next render, and still once it has settled, so the render
 * after the round trip reads it without suspending again.
 */
describe("evolu loadQuery, as the screen preloads use it", () => {
  test("returns the preload's promise to the hook, settled after one round trip", async () => {
    await using test = await createEvoluTest()
    const { evolu } = test
    const billId = createRandomBillId()

    const preloaded = [
      evolu.loadQuery(settingsQuery),
      evolu.loadQuery(billByIdQuery(billId)),
    ]
    expect(evolu.loadQuery(billByIdQuery(billId))).toBe(preloaded[1])

    await Promise.all(preloaded)

    expect(evolu.loadQuery(settingsQuery)).toBe(preloaded[0])
    expect(evolu.loadQuery(billByIdQuery(billId))).toBe(preloaded[1])
    // What React's `use` reads to return the rows instead of suspending.
    expect(preloaded.map((promise) => Reflect.get(promise, "status"))).toEqual([
      "fulfilled",
      "fulfilled",
    ])
  })
})
