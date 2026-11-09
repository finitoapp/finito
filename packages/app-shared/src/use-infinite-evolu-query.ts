import type { Evolu, Query, QueryRows, Row } from "@evolu/common"
import type { EvoluSchema } from "@payky/core/evolu/schema"
import { useMemo, useState, useTransition } from "react"
import { useEvoluQueryFor } from "./use-evolu-query-for.ts"

/** Shallow equality for a deps array, the same rule `useEffect`/`useMemo` use for theirs. */
function depsEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  return (
    a.length === b.length &&
    a.every((value, index) => Object.is(value, b[index]))
  )
}

/** The rows a page shows unless a list asks for another size. */
export const defaultInfinitePageSize = 20

/**
 * The limit a page query is built with: one row past what is shown, which
 * is how a page tells whether there is more without a count query.
 */
const pageQueryLimit = (shown: number): number => shown + 1

/**
 * The query of the first page `useInfinitePages` reads, for a screen that
 * preloads it with its other queries (`usePreloadEvoluQueries`). Built by
 * the same rule as the hook's own, so the preload is always the query the
 * list then waits on; pass the list's `pageSize` when it has one.
 */
export const firstInfinitePageQuery = <R extends Row>(
  createPageQuery: (limit: number) => Query<EvoluSchema, R>,
  { pageSize = defaultInfinitePageSize }: { readonly pageSize?: number } = {}
): Query<EvoluSchema, R> => createPageQuery(pageQueryLimit(pageSize))

/**
 * Pagination over any Evolu query, for both apps: grows a `limit` and exposes
 * `loadMore`; each app binds it to its own trigger (web's intersection
 * sentinel, native's `FlatList` `onEndReached`).
 *
 * `createPageQuery` should build a query for the *current* filters (search
 * text, category, ...) with the given `limit`; it requests `limit + 1` rows
 * internally and slices off the extra one to detect `hasMore` without a
 * separate count query. `deps` must list every value `createPageQuery`
 * closes over (the same convention as `useEffect`/`useMemo`), so pagination
 * resets to the first page exactly when one of them changes — a shallow
 * `Object.is` comparison per index, not a hand-joined string, so a new
 * filter can't be forgotten out of sync and a free-text value can't
 * accidentally collide with another filter's.
 *
 * Growing the limit happens inside `startTransition`, so React keeps the
 * already-rendered rows on screen while the bigger page loads (`isPending`)
 * instead of falling back to the nearest Suspense boundary — that fallback
 * still fires normally when `deps` changes, since that's a plain
 * (non-transition) update.
 */
export function useInfinitePages<R extends Row>(
  evolu: Evolu<EvoluSchema>,
  deps: readonly unknown[],
  createPageQuery: (limit: number) => Query<EvoluSchema, R>,
  { pageSize = defaultInfinitePageSize }: { readonly pageSize?: number } = {}
): {
  readonly rows: QueryRows<R>
  readonly hasMore: boolean
  readonly isPending: boolean
  readonly loadMore: () => void
} {
  const [state, setState] = useState({ deps, limit: pageSize })
  // Reset pagination back to the first page when the filter identity
  // changes, without an extra render round-trip through an effect (see
  // "Adjusting state when a prop changes" in the React docs).
  if (!depsEqual(state.deps, deps)) {
    setState({ deps, limit: pageSize })
  }
  const [isPending, startTransition] = useTransition()

  const query = useMemo(
    () => createPageQuery(pageQueryLimit(state.limit)),
    [createPageQuery, state.limit]
  )
  const { data: rows } = useEvoluQueryFor(evolu, query)
  const hasMore = rows.length > state.limit
  const visibleRows = hasMore ? rows.slice(0, state.limit) : rows

  const loadMore = () => {
    startTransition(() => {
      setState((current) => ({ ...current, limit: current.limit + pageSize }))
    })
  }

  return { rows: visibleRows, hasMore, isPending, loadMore }
}
