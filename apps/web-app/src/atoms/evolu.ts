import { isNonEmptyArray } from "@evolu/common"
import {
  type AtomLifetime,
  renewAtomLifetime,
} from "@payky/app-shared/atom-lifetime"
import { startCashuShardStore } from "@payky/core/cashu/cashu-shard-store"
import { createCashuWalletDep } from "@payky/core/cashu/cashu-wallet"
import { createLinkyOwnerSync } from "@payky/core/cashu/linky-owners"
import { startAppOwnerSyncUnlessRemoved } from "@payky/core/evolu/account-wipe"
import { createAppEvolu } from "@payky/core/evolu/client"
import { resolveTransportUrl } from "@payky/core/evolu/device-account"
import type { Evolu } from "@payky/core/evolu/schema"
import { fetchLinkyEvoluRelays } from "@payky/core/integrations/linky/linky-relays-client"
import { deriveCashuWalletSeed } from "@payky/core/modules/shared/key-derivation"
import { atom } from "jotai"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { runAtom } from "@/atoms/run.ts"
import { appEnv } from "@/core/app-env.ts"
import {
  createE2eCashuMintFetch,
  isE2eCashu,
} from "@/platform/e2e-cashu-mint.ts"
import { createFetchDep } from "@/platform/platform-deps.ts"

const evoluLifetimeAtom = atom<AtomLifetime>(() => ({ current: null }))
const cashuShardStoreLifetimeAtom = atom<AtomLifetime>(() => ({
  current: null,
}))

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
  // Ends the previous client as soon as a new account's one starts opening.
  const signal = renewAtomLifetime(get(evoluLifetimeAtom), options.signal)
  const account = await get(accountAtom)
  const deviceEvolu = await get(deviceEvoluAtom)
  const run = get(runAtom)
  let stopped = false
  const evolu = await run.ok(
    createAppEvolu({
      masterKey: account.masterKey,
      transports: [],
      // Deleted from another tab, or by an account removal that did not stop
      // this client first: reload, as Evolu does by default. A stopped one
      // is being replaced by the code that stopped it.
      onDatabaseDeleted: () => {
        if (!stopped) run.deps.reloadApp()
      },
    })
  )

  // The stored URLs may carry `${appOwnerId}` for a relay that addresses a
  // room by path. This is the first point where the owner those rows describe
  // actually exists, so it is where the placeholder turns into an id.
  // A demo account never syncs, whatever its transport rows say: its
  // fictional history must not reach a relay (demo-data/0001).
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

  // Fires when this atom recomputes (a new client is about to replace this
  // one) — store-owned, unlike a module-level variable, so a second store
  // (tests, HMR) never shares or clobbers this client's cleanup.
  signal.addEventListener(
    "abort",
    () => {
      stopSync?.()
      void evolu[Symbol.asyncDispose]()
    },
    { once: true }
  )

  return evolu
})

/**
 * Linky's owners in the app Evolu, next to Payky's own (cashu.md §2): the
 * store that syncs and writes the shared Cashu wallet, or null for a demo
 * account. Released with the app Evolu on an account switch.
 */
export const cashuShardStoreAtom = atom(async (get, options) => {
  const signal = renewAtomLifetime(
    get(cashuShardStoreLifetimeAtom),
    options.signal
  )
  const account = await get(accountAtom)
  const evolu = await get(evoluAtom)
  const run = get(runAtom)

  return startCashuShardStore({
    fallbackRelays: [
      appEnv.VITE_LINKY_EVOLU_RELAYS[0] ?? "wss://evolu.linky.fit",
      ...appEnv.VITE_LINKY_EVOLU_RELAYS.slice(1),
    ],
    evolu,
    // An e2e run with the fake mint keeps the wallet local, as a demo does.
    account: isE2eCashu() ? { ...account, demo: "seeded" } : account,
    ownerSync: createLinkyOwnerSync(run.deps.syncState, evolu.name),
    fetchRelays: async () => {
      await using fetchRun = run.create(createFetchDep())
      const relays = await fetchRun(
        fetchLinkyEvoluRelays(appEnv.VITE_LINKY_RELAYS_URL)
      )
      if (!relays.ok) return null
      const [first, ...rest] = relays.value
      return first === undefined ? null : [first, ...rest]
    },
    signal,
  })
})

/**
 * The account's cashu-ts wallets, one per mint and kept for the session, so
 * every run and the background jobs share loaded keysets (`CashuWalletDep`).
 */
export const cashuWalletDepAtom = atom(async (get) => {
  const account = await get(accountAtom)
  // A demo account reaches no mint (demo-data/0001): it gets the fake one its
  // history was generated against, which signs with the same keys.
  const fetch = isE2eCashu()
    ? await createE2eCashuMintFetch()
    : account.demo === null
      ? createFetchDep().fetch
      : await (async () => {
          const [{ createFakeCashuMint }, { MAIN_MINT_URL }] =
            await Promise.all([
              import("@payky/core/cashu/fake-cashu-mint"),
              import("@payky/core/cashu/cashu-mints"),
            ])
          return createFakeCashuMint({ url: MAIN_MINT_URL }).fetch
        })()
  return createCashuWalletDep({
    seed: deriveCashuWalletSeed(account.masterKey),
    deviceAccountId: account.id,
    fetch,
  })
})
