import type { Query, QueryRows, Row } from "@evolu/common"
import {
  useEvoluQueryFor,
  usePreloadEvoluQueriesFor,
} from "@payky/app-shared/use-evolu-query-for"
import type { DeviceEvoluSchema } from "@payky/core/evolu/device-client"
import type { EvoluSchema } from "@payky/core/evolu/schema"
import { useAtomValue } from "jotai"
import { deviceEvoluAtom } from "../atoms/device-evolu.ts"
import { evoluAtom } from "../atoms/evolu.ts"

/**
 * For a query that exists only in some states (a bill-scoped query on a cart
 * whose bill row is not written yet): `null` subscribes to nothing, so the
 * screen stays mounted across the transition.
 */
export const useOptionalEvoluQuery = <R extends Row>(
  query: Query<EvoluSchema, R> | null
): { data: QueryRows<R> } => useEvoluQueryFor(useAtomValue(evoluAtom), query)

export const useEvoluQuery = <R extends Row>(
  query: Query<EvoluSchema, R>
): { data: QueryRows<R> } => useOptionalEvoluQuery(query)

export const useDeviceEvoluQuery = <R extends Row>(
  query: Query<DeviceEvoluSchema, R>
): { data: QueryRows<R> } =>
  useEvoluQueryFor(useAtomValue(deviceEvoluAtom), query)

/**
 * Called first in a screen that reads several queries, so they load in one
 * round trip instead of one after another (`usePreloadEvoluQueriesFor`).
 */
export const usePreloadEvoluQueries = (
  queries: ReadonlyArray<Query<EvoluSchema, Row> | null>
): void => usePreloadEvoluQueriesFor(useAtomValue(evoluAtom), queries)

/** `usePreloadEvoluQueries` for the device database. */
export const usePreloadDeviceEvoluQueries = (
  queries: ReadonlyArray<Query<DeviceEvoluSchema, Row> | null>
): void => usePreloadEvoluQueriesFor(useAtomValue(deviceEvoluAtom), queries)
