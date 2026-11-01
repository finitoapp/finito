import type { Query, QueryRows, Row } from "@evolu/common"
import {
  useEvoluQueryFor,
  usePreloadEvoluQueriesFor,
} from "@payky/app-shared/use-evolu-query-for"
import type { DeviceEvoluSchema } from "@payky/core/evolu/device-client"
import { useAtomValue } from "jotai"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"

export const useDeviceEvoluQuery = <R extends Row>(
  query: Query<DeviceEvoluSchema, R>
): { data: QueryRows<R> } =>
  useEvoluQueryFor(useAtomValue(deviceEvoluAtom), query)

/** `usePreloadEvoluQueries` for the device database. */
export const usePreloadDeviceEvoluQueries = (
  queries: ReadonlyArray<Query<DeviceEvoluSchema, Row> | null>
): void => usePreloadEvoluQueriesFor(useAtomValue(deviceEvoluAtom), queries)
