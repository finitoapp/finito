import type {
  EvoluSchema as AnyEvoluSchema,
  Evolu,
  Query,
  QueryRows,
  Row,
} from "@evolu/common"
import { use, useMemo, useSyncExternalStore } from "react"

const emptyRows: QueryRows<never> = []
const subscribeToNothing = (): (() => void) => () => {}

/**
 * The shared body of `useOptionalEvoluQuery` and `useDeviceEvoluQuery`: load
 * the query for suspense, then track it through `useSyncExternalStore`. The
 * two public hooks differ only in which Evolu client and schema they bind to,
 * so the suspense and subscription semantics live here and are fixed once.
 *
 * A `null` query subscribes to nothing and yields no rows — see
 * `useOptionalEvoluQuery` for why a component needs that.
 */
export const useEvoluQueryFor = <S extends AnyEvoluSchema, R extends Row>(
  evolu: Evolu<S>,
  query: Query<S, R> | null
): { data: QueryRows<R> } => {
  // `use` is the one hook React allows to be called conditionally.
  if (query !== null) use(evolu.loadQuery(query))

  const data = useSyncExternalStore(
    useMemo(
      () => (query === null ? subscribeToNothing : evolu.subscribeQuery(query)),
      [evolu, query]
    ),
    useMemo<() => QueryRows<R>>(
      () => () => (query === null ? emptyRows : evolu.getQueryRows(query)),
      [evolu, query]
    )
  )

  return { data }
}

/**
 * The shared body of `usePreloadEvoluQueries` and
 * `usePreloadDeviceEvoluQueries`: start loading every query a screen reads,
 * before its first `useEvoluQuery` suspends.
 *
 * Each `useEvoluQuery` suspends on its own query, and a render stops at the
 * first one that is still loading, so a screen reading six queries otherwise
 * waits for six worker round trips one after another, rendering again after
 * each. Evolu sends the loads started in one microtask as one message, and
 * `loadQuery` returns the same promise for the same query, so the hooks below
 * this call all wait on that one round trip. A query the list misses costs
 * one round trip more, nothing else; `null` entries (a query that does not
 * exist yet) are skipped.
 */
export const usePreloadEvoluQueriesFor = <S extends AnyEvoluSchema>(
  evolu: Evolu<S>,
  queries: ReadonlyArray<Query<S, Row> | null>
): void => {
  for (const query of queries) {
    if (query !== null) void evolu.loadQuery(query)
  }
}
