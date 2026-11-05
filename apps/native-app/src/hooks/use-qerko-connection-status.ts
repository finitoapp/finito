import type { QerkoConnectionStatus } from "@payky/core/integrations/qerko/qerko-connection-status"
import { useSyncExternalStore } from "react"

import { qerkoConnectionStatusStore } from "../atoms/qerko-connection-status.ts"

/** This device's Qerko payment connection, as the connection job reports it. */
export const useQerkoConnectionStatus = (): QerkoConnectionStatus =>
  useSyncExternalStore(
    qerkoConnectionStatusStore.subscribe,
    qerkoConnectionStatusStore.get
  )
