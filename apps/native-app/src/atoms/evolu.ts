import { isNonEmptyArray } from "@evolu/common"
import {
  type AtomLifetime,
  renewAtomLifetime,
} from "@payky/app-shared/atom-lifetime"
import { startAppOwnerSyncUnlessRemoved } from "@payky/core/evolu/account-wipe"
import { createAppEvolu } from "@payky/core/evolu/client"
import { resolveTransportUrl } from "@payky/core/evolu/device-account"
import type { Evolu } from "@payky/core/evolu/schema"
import { accessControlQuery } from "@payky/core/modules/access/access-queries"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { deviceByIdQuery } from "@payky/core/modules/device/device-queries"
import { atom } from "jotai"
import { nativeConsole, nativeRun } from "../core/native-runtime.ts"
import { accountAtom } from "./account.ts"
import { deviceEvoluAtom } from "./device-evolu.ts"

const evoluLifetimeAtom = atom<AtomLifetime>(() => ({ current: null }))

/**
 * What stops each app client syncing, so a device leaving its account stops
 * before it forgets it (access/0014). Keyed by the client, not the store.
 */
const appSyncStops = new WeakMap<Evolu, () => void>()

/**
 * Stops the app client syncing for good: changes written after it reach no
 * relay, and deleting its database (`removeAccountFromDevice`) disposes it
 * without reloading the app, since the caller moves off the account itself.
 */
export const stopAppEvoluSync = (evolu: Evolu) => {
  appSyncStops.get(evolu)?.()
}

export const evoluAtom = atom(async (get, options) => {
  // Ends the previous account's client as soon as a new one starts opening.
  const signal = renewAtomLifetime(get(evoluLifetimeAtom), options.signal)
  const account = await get(accountAtom)
  const deviceEvolu = await get(deviceEvoluAtom)
  let stopped = false
  const evolu = await nativeRun.ok(
    createAppEvolu({
      masterKey: account.masterKey,
      transports: [],
      // Deleted by an account removal that did not stop this client first:
      // reload, as Evolu does by default. A stopped one is being replaced by
      // the code that stopped it.
      onDatabaseDeleted: () => {
        if (!stopped) nativeRun.deps.reloadApp()
      },
    })
  )
  // The access gate's queries and the home screen's settings, loaded as one
  // batch before anything asks: each would otherwise suspend its component
  // for a round trip of its own, one after the other. They stay subscribed
  // for this client's life, because Evolu drops the rows of unsubscribed
  // queries at the first write, and a start writes before the home screen
  // subscribes (the device registration), which loaded them again.
  const startupQueries = [
    accessControlQuery,
    deviceByIdQuery(account.device.id),
    settingsQuery,
  ]
  const unsubscribeStartupQueries = startupQueries.map((query) =>
    evolu.subscribeQuery(query)(() => {})
  )
  void Promise.allSettled(evolu.loadQueries(startupQueries))

  // Stored URLs may carry `${appOwnerId}`; a demo account never syncs.
  const transports =
    account.demo === null
      ? account.transports.flatMap((transport) => {
          const url = resolveTransportUrl(transport.url, evolu.appOwner.id)
          return url === null ? [] : [{ ...transport, url }]
        })
      : []
  // Not when the local copy already holds this device's removal: the data
  // is then deleted as `DeviceRegistration` signs the device out.
  const stopSync = isNonEmptyArray(transports)
    ? startAppOwnerSyncUnlessRemoved({
        evolu,
        deviceEvolu,
        accountId: account.id,
        deviceId: account.device.id,
        transports,
      })
    : undefined
  appSyncStops.set(evolu, () => {
    stopped = true
    stopSync?.()
  })

  const dispose = () => {
    nativeConsole.debug("Disposing app Evolu.", { accountId: account.id })
    for (const unsubscribe of unsubscribeStartupQueries) unsubscribe()
    stopSync?.()
    void evolu[Symbol.asyncDispose]()
  }
  if (signal.aborted) dispose()
  else signal.addEventListener("abort", dispose, { once: true })

  return evolu
})
