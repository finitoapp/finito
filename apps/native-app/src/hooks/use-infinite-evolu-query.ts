import type { Query, Row } from "@evolu/common"
import { useInfinitePages } from "@payky/app-shared/use-infinite-evolu-query"
import type { EvoluSchema } from "@payky/core/evolu/schema"
import { useAtomValue } from "jotai"
import { evoluAtom } from "../atoms/evolu.ts"

/**
 * Pagination over an Evolu query, shared with web (`useInfinitePages`); the
 * list calls `loadMore` from `onEndReached`.
 */
export const useInfiniteEvoluQuery = <R extends Row>(
  deps: readonly unknown[],
  createPageQuery: (limit: number) => Query<EvoluSchema, R>,
  options: { readonly pageSize?: number } = {}
) => useInfinitePages(useAtomValue(evoluAtom), deps, createPageQuery, options)
