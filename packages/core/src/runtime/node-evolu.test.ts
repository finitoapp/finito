import {
  type CreateSqliteDriver,
  createRun,
  Port,
  WebSocketUrlFromString,
} from "@evolu/common"
import {
  createNodeJsSqliteDriver,
  createRelay,
  createRelayDeps,
} from "@evolu/nodejs"
import { describe, expect, test, vi } from "vitest"

import { createQuery } from "../evolu/schema.ts"
import {
  createMasterKey,
  deriveTableSelfPayRoot,
} from "../modules/shared/key-derivation.ts"
import {
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
} from "../modules/shared/schema.ts"
import { createNodeEvolu } from "./node-evolu.ts"

const createMemorySqliteDriver: CreateSqliteDriver = (name) =>
  createNodeJsSqliteDriver(name, { mode: "memory" })

const tableNamesQuery = createQuery((db) =>
  db.selectFrom("table").select("name")
)

describe("createNodeEvolu", () => {
  test("syncs two databases opened with one master key through a relay", async () => {
    await using relayRun = createRun({
      ...createRelayDeps(),
      createSqliteDriver: createMemorySqliteDriver,
    })
    await using relay = await relayRun.ok(
      createRelay({ port: Port.orThrow(0), isOwnerWithinQuota: () => true })
    )
    const account = {
      masterKey: createMasterKey(),
      transports: [
        {
          type: "WebSocket",
          url: WebSocketUrlFromString.orThrow(`ws://localhost:${relay.port}`),
        },
      ] as const,
    }
    await using writer = await createNodeEvolu("memory", account)
    await using reader = await createNodeEvolu("memory", account)

    writer.evolu.insert("table", {
      deviceId: null,
      name: NonEmptyString255("Terrace"),
      seatCount: PositiveInteger(4),
      code: NonEmptyString255("T1"),
      sortOrder: NonNegativeInteger(0),
    })

    expect(reader.evolu.appOwner.id).toBe(writer.evolu.appOwner.id)
    await vi.waitFor(
      async () => {
        expect(await reader.evolu.loadQuery(tableNamesQuery)).toEqual([
          { name: "Terrace" },
        ])
      },
      { timeout: 10_000, interval: 100 }
    )
  })

  test("carries the self-pay root of its account, and none without one", async () => {
    const masterKey = createMasterKey()
    await using withAccount = await createNodeEvolu("memory", {
      masterKey,
      transports: [],
    })
    await using withoutAccount = await createNodeEvolu("memory")

    expect(withAccount.tableSelfPayRoot).toEqual(
      deriveTableSelfPayRoot(masterKey)
    )
    expect(withoutAccount.tableSelfPayRoot).toBeUndefined()
  })
})
