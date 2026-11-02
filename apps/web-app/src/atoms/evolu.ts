import { isNonEmptyArray } from "@evolu/common"
import {
  type AtomLifetime,
  renewAtomLifetime,
} from "@payky/app-shared/atom-lifetime"
import { startCashuShardStore } from "@payky/core/cashu/cashu-shard-store"
import { createCashuWalletDep } from "@payky/core/cashu/cashu-wallet"
import { createLinkyOwnerSync } from "@payky/core/cashu/linky-owners"
import { createAppEvolu } from "@payky/core/evolu/client"
import { resolveTransportUrl } from "@payky/core/evolu/device-account"
import { fetchLinkyEvoluRelays } from "@payky/core/integrations/linky/linky-relays-client"
import { deriveCashuWalletSeed } from "@payky/core/modules/shared/key-derivation"
import { atom } from "jotai"
import { accountAtom } from "@/atoms/account.ts"
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

export const evoluAtom = atom(async (get, options) => {
  // Ends the previous client as soon as a new account's one starts opening.
  const signal = renewAtomLifetime(get(evoluLifetimeAtom), options.signal)
  const account = await get(accountAtom)
  const run = get(runAtom)
  const evolu = await run.ok(
    createAppEvolu({
      masterKey: account.masterKey,
      transports: [],
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

  const unuse = isNonEmptyArray(transports)
    ? // biome-ignore lint/correctness/useHookAtTopLevel: This is not react hook
      evolu.useOwner(evolu.appOwner, transports)
    : undefined

  // Fires when this atom recomputes (a new client is about to replace this
  // one) — store-owned, unlike a module-level variable, so a second store
  // (tests, HMR) never shares or clobbers this client's cleanup.
  signal.addEventListener(
    "abort",
    () => {
      unuse?.()
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
