import type { Query, QueryRows, Row } from "@evolu/common"
import {
  useEvoluQueryFor,
  usePreloadEvoluQueriesFor,
} from "@payky/app-shared/use-evolu-query-for"
import type { EvoluSchema } from "@payky/core/evolu/schema"
import { useEvolu } from "@/hooks/use-evolu.ts"

/**
 * `useEvoluQuery` for a query that only exists in some states, for example a
 * bill-scoped query on a cart whose bill hasn't been created yet. A `null`
 * query subscribes to nothing and yields no rows, which lets a component
 * that owns both states stay mounted across the transition instead of being
 * torn down and rebuilt — a remount replaces every DOM node under it, and a
 * tap whose press and release straddle that swap is silently dropped by the
 * browser (its click lands on the two nodes' common ancestor, not on the
 * button). See `BillPage`.
 */
export const useOptionalEvoluQuery = <R extends Row>(
  query: Query<EvoluSchema, R> | null
): { data: QueryRows<R> } => useEvoluQueryFor(useEvolu(), query)

export const useEvoluQuery = <R extends Row>(
  query: Query<EvoluSchema, R>
): { data: QueryRows<R> } => useOptionalEvoluQuery(query)

/**
 * Called first in a screen that reads several queries, so they load in one
 * round trip instead of one after another (`usePreloadEvoluQueriesFor`).
 */
export const usePreloadEvoluQueries = (
  queries: ReadonlyArray<Query<EvoluSchema, Row> | null>
): void => usePreloadEvoluQueriesFor(useEvolu(), queries)
