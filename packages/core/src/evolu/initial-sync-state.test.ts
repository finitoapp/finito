import {
  createId,
  createIdFromString,
  Millis,
  RelayUrl,
  testAppOwner,
  testCreateDeps,
  testName,
} from "@evolu/common"
import type {
  RelaySyncState,
  SyncConnection,
  SyncRoute,
  SyncState,
} from "@evolu/common/local-first"
import { describe, expect, test } from "vitest"

import {
  evaluateInitialSync,
  findOwnerRelays,
  initialSyncIdleLimitMs,
  isInitialSyncPending,
  type OwnerRelays,
} from "./initial-sync-state.ts"

const deps = testCreateDeps()

type RelayKind = "synced" | "syncing" | "connecting" | "error" | "unreachable"

const open: SyncConnection = {
  type: "Open",
  openedAt: Millis.orThrow(1),
  error: null,
}

const relay = (
  kind: RelayKind,
  { completedBefore = false }: { readonly completedBefore?: boolean } = {}
): RelaySyncState => {
  const transportId = createId<"SyncTransport">(deps)
  const connection: SyncConnection =
    kind === "connecting"
      ? { type: "Connecting" }
      : kind === "unreachable"
        ? {
            type: "Disconnected",
            disconnectedAt: Millis.orThrow(2),
            openedAt: null,
            error: { type: "WebSocketConnectError", at: Millis.orThrow(2) },
          }
        : open
  const route: SyncRoute =
    kind === "synced"
      ? {
          type: "Complete",
          transportId,
          completeAt: Millis.orThrow(1000),
          lastSentAt: Millis.orThrow(900),
          lastReceivedAt: Millis.orThrow(1000),
        }
      : {
          type: "Pending",
          transportId,
          failure:
            kind === "error"
              ? { type: "SyncFailed", at: Millis.orThrow(3) }
              : null,
          skippedError: null,
          completeAt: completedBefore ? Millis.orThrow(1000) : null,
          lastSentAt: null,
          lastReceivedAt: null,
        }
  return {
    transport: {
      type: "WebSocket",
      id: transportId,
      label: RelayUrl.orThrow(`wss://${transportId.toLowerCase()}.example/`),
      connection,
    },
    route,
  }
}

const evaluate = (input: Partial<Parameters<typeof evaluateInitialSync>[0]>) =>
  evaluateInitialSync({
    relays: null,
    hasSettings: false,
    online: true,
    idleForMs: 0,
    ...input,
  })

describe("findOwnerRelays", () => {
  const stateWith = (relays: OwnerRelays): SyncState => ({
    transports: relays.map(({ transport }) => transport),
    tenants: [
      {
        type: "Active",
        name: testName,
        owners: [
          {
            type: "Writable",
            ownerId: testAppOwner.id,
            routes: relays.map(({ route }) => route),
          },
        ],
      },
    ],
  })

  test("pairs the owner's routes with their transports", () => {
    const synced = relay("synced")

    expect(
      findOwnerRelays(stateWith([synced]), testName, testAppOwner.id)
    ).toEqual([synced])
  })

  test("is null until the worker reports the owner, unlike an owner with no relays", () => {
    expect(findOwnerRelays(null, testName, testAppOwner.id)).toBeNull()
    expect(
      findOwnerRelays(
        stateWith([]),
        testName,
        createIdFromString<"OwnerId">("other")
      )
    ).toBeNull()
    expect(findOwnerRelays(stateWith([]), testName, testAppOwner.id)).toEqual(
      []
    )
  })
})

describe("evaluateInitialSync", () => {
  test("local settings win over any relay state", () => {
    expect(evaluate({ hasSettings: true, online: false })).toBe("restored")
  })

  test("fails right away while offline", () => {
    expect(evaluate({ relays: [relay("syncing")], online: false })).toBe(
      "failed"
    )
  })

  test("waits while any relay syncs, however long it takes", () => {
    expect(
      evaluate({
        relays: [relay("synced"), relay("syncing")],
        idleForMs: initialSyncIdleLimitMs * 10,
      })
    ).toBe("waiting")
  })

  test("is empty once every relay synced without settings", () => {
    expect(evaluate({ relays: [relay("synced"), relay("synced")] })).toBe(
      "empty"
    )
  })

  test("fails when a relay failed and the rest synced empty", () => {
    expect(evaluate({ relays: [relay("synced"), relay("error")] })).toBe(
      "failed"
    )
    expect(evaluate({ relays: [relay("synced"), relay("unreachable")] })).toBe(
      "failed"
    )
  })

  test("waits on a relay still connecting until the idle limit", () => {
    const connecting = [relay("synced"), relay("connecting")]

    expect(evaluate({ relays: connecting })).toBe("waiting")
    expect(
      evaluate({ relays: connecting, idleForMs: initialSyncIdleLimitMs })
    ).toBe("failed")
    expect(evaluate({ relays: null, idleForMs: initialSyncIdleLimitMs })).toBe(
      "failed"
    )
  })
})

describe("isInitialSyncPending", () => {
  test("is pending while the first sync transfers", () => {
    expect(isInitialSyncPending([relay("syncing")])).toBe(true)
  })

  test("is settled after a completed sync or with no open relay", () => {
    expect(
      isInitialSyncPending([relay("syncing", { completedBefore: true })])
    ).toBe(false)
    expect(isInitialSyncPending([relay("connecting")])).toBe(false)
  })
})
