/**
 * Where this device's Qerko payment connection stands (qerko/0011), for the
 * UI to show. It is local on purpose: whether the websocket is up, or was
 * taken over, is a fact about this device and does not sync. The connection
 * job writes it; screens read it through `subscribe`/`get`.
 */
export type QerkoConnectionStatus =
  /** This device does not hold the connection: not chosen, not paired or off. */
  | { readonly type: "idle" }
  | { readonly type: "connecting" }
  | { readonly type: "connected" }
  /** The line dropped; the next try is at `retryAt` (ms since the epoch). */
  | { readonly type: "reconnecting"; readonly retryAt: number }
  /** Another connection took the restaurant's one websocket (close 4409). */
  | { readonly type: "stolen" }
  /** Qerko refused the key: it needs pairing again. */
  | { readonly type: "unauthorized" }

export interface QerkoConnectionStatusStore {
  readonly get: () => QerkoConnectionStatus
  readonly subscribe: (listener: () => void) => () => void
  readonly set: (status: QerkoConnectionStatus) => void
  /**
   * Asks a stopped connection (stolen or unauthorized) to try again: what
   * choosing this device again does, since the synced choice does not change.
   */
  readonly resume: () => void
  readonly onResume: (listener: () => void) => () => void
}

export interface QerkoConnectionStatusDep {
  readonly qerkoConnectionStatus: QerkoConnectionStatusStore
}

export const createQerkoConnectionStatusStore =
  (): QerkoConnectionStatusStore => {
    let status: QerkoConnectionStatus = { type: "idle" }
    const listeners = new Set<() => void>()
    const resumeListeners = new Set<() => void>()
    return {
      get: () => status,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      set: (next) => {
        status = next
        for (const listener of listeners) listener()
      },
      resume: () => {
        for (const listener of resumeListeners) listener()
      },
      onResume: (listener) => {
        resumeListeners.add(listener)
        return () => resumeListeners.delete(listener)
      },
    }
  }

export const createQerkoConnectionStatusDep = (
  store: QerkoConnectionStatusStore = createQerkoConnectionStatusStore()
): QerkoConnectionStatusDep => ({ qerkoConnectionStatus: store })
