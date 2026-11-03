import type { Query, QueryRows, Row } from "@evolu/common"
import type { EvoluSchema } from "@payky/core/evolu/schema"
import { ListSkeleton } from "@/components/list-skeleton.tsx"
import {
  VerticalNav,
  type VerticalNavItem,
} from "@/components/vertical-nav.tsx"
import { useInfiniteEvoluQuery } from "@/hooks/use-infinite-evolu-query.ts"

/**
 * Infinite-scroll list for a settings screen, generic over the row type.
 * Filtering runs in SQL inside `createPageQuery`, not over an already-loaded
 * result set; pagination is `useInfiniteEvoluQuery`'s job — see there for how
 * "load more" keeps rendered rows on screen while a change to `deps` shows a
 * full-list skeleton via the caller's `<Suspense>` boundary.
 *
 * `hasAny` distinguishes the two ways a list can come back empty: a screen
 * with no records at all gets the pitch for creating the first one, while a
 * search that matched nothing gets a single line saying so.
 *
 * Callers supply `createPageQuery` from their own `useCallback` — the hook
 * memoises on its identity — and turn a row into a nav item themselves, which
 * is the part that is actually per-entity.
 */
export function CatalogEntityList<R extends Row>({
  deps,
  createPageQuery,
  renderItem,
  hasAny,
  emptyTitle,
  emptyDescription,
  emptySearchLabel,
}: {
  readonly deps: readonly unknown[]
  readonly createPageQuery: (limit: number) => Query<EvoluSchema, R>
  readonly renderItem: (row: QueryRows<R>[number]) => VerticalNavItem
  readonly hasAny: boolean
  readonly emptyTitle: string
  readonly emptyDescription: string
  readonly emptySearchLabel: string
}) {
  const { rows, hasMore, isPending, sentinelRef } = useInfiniteEvoluQuery(
    deps,
    createPageQuery
  )

  return (
    <>
      <VerticalNav
        empty={
          hasAny ? (
            <p className="py-10 text-center text-muted-foreground">
              {emptySearchLabel}
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-lg font-semibold">{emptyTitle}</p>
              <p className="text-balance text-sm text-muted-foreground">
                {emptyDescription}
              </p>
            </div>
          )
        }
        items={rows.map(renderItem)}
      />
      {hasMore && (
        <>
          {isPending && <ListSkeleton rows={5} />}
          <div ref={sentinelRef} aria-hidden className="h-1" />
        </>
      )}
    </>
  )
}
