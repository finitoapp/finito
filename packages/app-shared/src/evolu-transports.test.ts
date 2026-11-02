import {
  createId,
  createIdFromString,
  Millis,
  type OwnerId,
  RelayUrl,
  testAppOwner,
  testCreateDeps,
  testName,
} from "@evolu/common"
import type {
  SyncRoute,
  SyncState,
  SyncTransport,
} from "@evolu/common/local-first"
import { appOwnerIdPlaceholder } from "@payky/core/evolu/device-account"
import { describe, expect, test } from "vitest"
import {
  findRelaySyncState,
  splitTransportUrl,
  toTransportSyncKind,
} from "./evolu-transports.ts"

const deps = testCreateDeps()

const transport: SyncTransport = {
  type: "WebSocket",
  id: createId<"SyncTransport">(deps),
  label: RelayUrl.orThrow("wss://relay.example/room"),
  connection: { type: "Open", openedAt: Millis.orThrow(800), error: null },
}

const route: SyncRoute = {
  type: "Complete",
  transportId: transport.id,
  completeAt: Millis.orThrow(1000),
  lastSentAt: Millis.orThrow(900),
  lastReceivedAt: Millis.orThrow(1000),
}

const stateFor = (ownerId: OwnerId): SyncState => ({
  transports: [transport],
  tenants: [
    {
      type: "Active",
      name: testName,
      owners: [{ type: "Writable", ownerId, routes: [route] }],
    },
  ],
})

describe("findRelaySyncState", () => {
  test("matches the configured url, ignoring its query", () => {
    const relay = findRelaySyncState(
      stateFor(testAppOwner.id),
      testName,
      testAppOwner.id,
      "wss://relay.example/room?ownerId=x"
    )

    expect(relay).toEqual({ transport, route })
  })

  test("ignores another owner's relay and an unknown url", () => {
    const otherOwnerId = createIdFromString<"OwnerId">("other")

    expect(
      findRelaySyncState(
        stateFor(otherOwnerId),
        testName,
        testAppOwner.id,
        transport.label
      )
    ).toBeNull()
    expect(
      findRelaySyncState(
        stateFor(testAppOwner.id),
        testName,
        testAppOwner.id,
        "wss://other.example"
      )
    ).toBeNull()
    expect(
      findRelaySyncState(null, testName, testAppOwner.id, transport.label)
    ).toBeNull()
  })
})

describe("splitTransportUrl", () => {
  test("cuts at the owner-id placeholder and strips the scheme", () => {
    expect(
      splitTransportUrl(`wss://relay.example/${appOwnerIdPlaceholder}/x`)
    ).toEqual({ scheme: "wss://", parts: ["relay.example/", "/x"] })
    expect(splitTransportUrl("wss://relay.example")).toEqual({
      scheme: "wss://",
      parts: ["relay.example"],
    })
  })
})

describe("toTransportSyncKind", () => {
  test("is connecting until the relay is reported", () => {
    expect(toTransportSyncKind(null, null)).toBe("connecting")
  })
})
