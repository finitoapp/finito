import { isNonEmptyArray } from "@evolu/common"
import {
  type AtomLifetime,
  renewAtomLifetime,
} from "@payky/app-shared/atom-lifetime"
import { createAppEvolu } from "@payky/core/evolu/client"
import { resolveTransportUrl } from "@payky/core/evolu/device-account"
import { accessControlQuery } from "@payky/core/modules/access/access-queries"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { deviceByIdQuery } from "@payky/core/modules/device/device-queries"
import { atom } from "jotai"
import { nativeConsole, nativeRun } from "../core/native-runtime.ts"
import { accountAtom } from "./account.ts"

const evoluLifetimeAtom = atom<AtomLifetime>(() => ({ current: null }))

export const evoluAtom = atom(async (get, options) => {
  // Ends the previous account's client as soon as a new one starts opening.
  const signal = renewAtomLifetime(get(evoluLifetimeAtom), options.signal)
  const account = await get(accountAtom)
  const evolu = await nativeRun.ok(
    createAppEvolu({ masterKey: account.masterKey, transports: [] })
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
  const unuse = isNonEmptyArray(transports)
    ? // biome-ignore lint/correctness/useHookAtTopLevel: This is not a react hook
      evolu.useOwner(evolu.appOwner, transports)
    : undefined

  const dispose = () => {
    nativeConsole.debug("Disposing app Evolu.", { accountId: account.id })
    for (const unsubscribe of unsubscribeStartupQueries) unsubscribe()
    unuse?.()
    void evolu[Symbol.asyncDispose]()
  }
  if (signal.aborted) dispose()
  else signal.addEventListener("abort", dispose, { once: true })

  return evolu
})
