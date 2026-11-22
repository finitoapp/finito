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

import { MasterKey } from "../modules/shared/key-derivation.ts"
import { createNodeEvolu } from "../runtime/node-evolu.ts"

type NodeEvolu = Awaited<ReturnType<typeof createNodeEvolu>>

export interface SyncedDevice {
  readonly evolu: NodeEvolu["evolu"]
  readonly appOwnerSync: NodeEvolu["appOwnerSync"]
  readonly connect: () => void
  readonly disconnect: () => void
}

export interface SyncedDevices extends AsyncDisposable {
  readonly addDevice: (options?: {
    readonly online?: boolean
  }) => Promise<SyncedDevice>
}

export const createSyncedDevices = async (
  masterKey: MasterKey = MasterKey("00112233445566778899aabbccddeeff")
): Promise<SyncedDevices> => {
  await using disposer = new AsyncDisposableStack()
  const run = disposer.use(
    createRun({
      ...createRelayDeps(),
      createSqliteDriver: ((name) =>
        createNodeJsSqliteDriver(name, {
          mode: "memory",
        })) satisfies CreateSqliteDriver,
    })
  )
  const relay = disposer.use(
    await run.ok(
      createRelay({ port: Port.orThrow(0), isOwnerWithinQuota: () => true })
    )
  )
  const devices = new AsyncDisposableStack()
  disposer.use(devices)
  const disposables = disposer.move()

  return {
    addDevice: async ({ online = true } = {}) => {
      const { evolu, appOwnerSync } = devices.use(
        await createNodeEvolu("memory", { masterKey, transports: [] })
      )
      let unuse: (() => void) | null = null
      const device: SyncedDevice = {
        evolu,
        appOwnerSync,
        connect: () => {
          unuse ??= evolu.useOwner(evolu.appOwner, [
            {
              type: "WebSocket",
              url: WebSocketUrlFromString.orThrow(
                `ws://localhost:${relay.port}`
              ),
            },
          ])
        },
        disconnect: () => {
          unuse?.()
          unuse = null
        },
      }
      if (online) device.connect()
      return device
    },
    [Symbol.asyncDispose]: () => disposables.disposeAsync(),
  }
}
