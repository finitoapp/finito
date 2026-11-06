import {
  type KyselyNotNull,
  ok,
  type SqliteBoolean,
  sqliteTrue,
} from "@evolu/common"

import { upsertAccountEvoluWebsocketTransport } from "../evolu/device-account.ts"
import {
  createDeviceQuery,
  type DeviceAccountId,
} from "../evolu/device-client.ts"
import type { DeviceEvoluDep } from "../modules/shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../modules/shared/evolu-utils.ts"
import { WssUrl } from "../modules/shared/schema.ts"
import type { DeviceMigration } from "./migrations.ts"

const linkyRelay = WssUrl("wss://evolu.linky.fit")
const agoraRelay = WssUrl("wss://evolu.agora.gripe")

const accountRelaysQuery = createDeviceQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin(
      "accountEvoluTransport",
      "accountEvoluTransport.accountId",
      "account.id"
    )
    .innerJoin(
      "accountEvoluTransportWebsocket",
      "accountEvoluTransportWebsocket.id",
      "accountEvoluTransport.id"
    )
    .select([
      "account.id as accountId",
      "accountEvoluTransport.isActive as isActive",
      "accountEvoluTransportWebsocket.url as url",
    ])
    .where("account.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .where("account.masterKey", "is not", null)
    .where("accountEvoluTransport.isDeleted", "is not", sqliteTrue)
    .where("accountEvoluTransport.isActive", "is not", null)
    .where("accountEvoluTransportWebsocket.isDeleted", "is not", sqliteTrue)
    .where("accountEvoluTransportWebsocket.url", "is not", null)
    .$narrowType<{ isActive: KyselyNotNull; url: KyselyNotNull }>()
)

interface AgoraRelayAddition {
  readonly accountId: DeviceAccountId
  readonly isActive: SqliteBoolean
}

const loadAgoraRelayAdditions = async ({
  deviceEvolu,
}: DeviceEvoluDep): Promise<ReadonlyArray<AgoraRelayAddition>> => {
  const rows = await deviceEvolu.loadQuery(accountRelaysQuery)
  const hasAgoraRelay = new Set(
    rows.filter((row) => row.url === agoraRelay).map((row) => row.accountId)
  )
  return rows
    .filter(
      (row) => row.url === linkyRelay && !hasAgoraRelay.has(row.accountId)
    )
    .map((row) => ({ accountId: row.accountId, isActive: row.isActive }))
}

export const agoraEvoluRelayMigration: DeviceMigration = {
  name: "2026-10-13-agora-evolu-relay",
  hasWork: async (run) =>
    ok((await loadAgoraRelayAdditions(run.deps)).length > 0),
  run: async (run) => {
    const { deviceEvolu } = run.deps
    const additions = await loadAgoraRelayAdditions(run.deps)
    if (additions.length === 0) return ok(0)

    await runMutationWithCompletion((options) => {
      for (const { accountId, isActive } of additions) {
        upsertAccountEvoluWebsocketTransport(
          deviceEvolu,
          { accountId, isActive, url: agoraRelay },
          options
        )
      }
    })

    return ok(additions.length)
  },
}
