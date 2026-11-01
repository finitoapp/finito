import type { Evolu, EvoluSchema, Query } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { usePreloadEvoluQueriesFor } from "./use-evolu-query-for.ts"

const query = (sql: string) => sql as unknown as Query<EvoluSchema>

describe("usePreloadEvoluQueriesFor", () => {
  test("starts every query in the same tick, skipping null", () => {
    const loaded: string[] = []
    const evolu = {
      loadQuery: (loadedQuery: Query<EvoluSchema>) => {
        loaded.push(loadedQuery)
        return Promise.resolve([])
      },
    } as unknown as Evolu<EvoluSchema>

    usePreloadEvoluQueriesFor(evolu, [query("a"), null, query("b")])

    // Synchronously, so Evolu's microtask batch sends them as one message.
    expect(loaded).toEqual(["a", "b"])
  })
})
