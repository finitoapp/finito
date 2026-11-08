import { createDateDep } from "@payky/core/deps"
import { createEetApiDep } from "@payky/core/integrations/eet/eet-client"
import { createNostrDep } from "@payky/core/integrations/nostr/nostr-client"
import { createQerkoApiDep } from "@payky/core/integrations/qerko/qerko-client"
import { createYadioApiDep } from "@payky/core/integrations/yadio/yadio-client"
import { createSparkWalletDep } from "@payky/core/spark/spark-wallet"
import * as Crypto from "expo-crypto"
import { useAtomValue, useStore } from "jotai"
import { useCallback } from "react"
import { accountAtom } from "../atoms/account.ts"
import { cashuShardStoreAtom, cashuWalletDepAtom } from "../atoms/cashu.ts"
import { deviceEvoluAtom } from "../atoms/device-evolu.ts"
import { evoluAtom } from "../atoms/evolu.ts"
import { nativeEnv } from "../core/native-env.ts"
import { nativeConsole, nativeRun } from "../core/native-runtime.ts"
import { createE2eSparkWalletDep } from "../e2e/e2e-spark-presets.ts"
import { eetNativeCrypto } from "../platform/eet-crypto"
import { lockManager } from "../platform/evolu-runtime"
import { createFetchDep } from "../platform/native-deps.ts"
import {
  createSwitchioClosureDep,
  createSwitchioRefundDep,
  createSwitchioTerminalDep,
} from "../platform/switchio.ts"

/**
 * Native composition root for Task actions, the counterpart of web's
 * `useAppRun`: the same dependency set (console, evolu, deviceEvolu,
 * evoluOwner, masterKey, lockManager, date, fetch, sparkWallet, yadioApi,
 * qerkoApi, switchioTerminal, switchioClosure, switchioRefund, eetApi,
 * nostr), built fresh for each run. Use as `await using run = appRun()`. The Cashu wallet comes from `useCashuAppRun`.
 */
/** Every app dependency but the Cashu ones, built fresh for each run. */
function useAppRunDeps() {
  const evolu = useAtomValue(evoluAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const account = useAtomValue(accountAtom)

  return useCallback(() => {
    const dateDep = createDateDep()
    const fetchDep = createFetchDep()
    return {
      console: nativeConsole,
      evolu,
      deviceEvolu,
      evoluOwner: evolu.appOwner,
      masterKey: account.masterKey,
      lockManager,
      ...dateDep,
      ...fetchDep,
      ...(createE2eSparkWalletDep() ?? createSparkWalletDep()),
      ...createYadioApiDep({ baseUrl: nativeEnv.EXPO_PUBLIC_PAYKY_YADIO_URL }),
      ...createQerkoApiDep({
        posId: nativeEnv.EXPO_PUBLIC_PAYKY_QERKO_POS_ID,
        baseUrl: nativeEnv.EXPO_PUBLIC_PAYKY_QERKO_BASE_URL,
      }),
      uuid: { create: () => Crypto.randomUUID() },
      ...createSwitchioTerminalDep({ demo: account.demo !== null }),
      ...createSwitchioClosureDep({ demo: account.demo !== null }),
      ...createSwitchioRefundDep({ demo: account.demo !== null }),
      ...createEetApiDep(
        { ...dateDep, ...fetchDep },
        {
          productionUrl: nativeEnv.EXPO_PUBLIC_PAYKY_EET_PRODUCTION_URL,
          playgroundUrl: nativeEnv.EXPO_PUBLIC_PAYKY_EET_PLAYGROUND_URL,
          native: eetNativeCrypto,
        }
      ),
      ...createNostrDep(nativeEnv.EXPO_PUBLIC_PAYKY_NOSTR_RELAYS),
    }
  }, [account.demo, account.masterKey, deviceEvolu, evolu])
}

export function useAppRun() {
  const appRunDeps = useAppRunDeps()
  return useCallback(() => nativeRun.create(appRunDeps()), [appRunDeps])
}

/**
 * `useAppRun` plus the shared Cashu wallet (`cashuShardStore`, `cashuWallet`),
 * for the Cashu actions only: `await using run = await cashuAppRun()`. The
 * Cashu atoms are read when a run is made, never while rendering, so a wallet
 * that fails to start, or never does, holds up no screen; the call that
 * needed it rejects instead.
 */
export function useCashuAppRun() {
  const appRunDeps = useAppRunDeps()
  const jotaiStore = useStore()
  return useCallback(async () => {
    const [cashuShardStore, cashuWalletDep] = await Promise.all([
      jotaiStore.get(cashuShardStoreAtom),
      jotaiStore.get(cashuWalletDepAtom),
    ])
    return nativeRun.create({
      ...appRunDeps(),
      cashuShardStore,
      ...cashuWalletDep,
    })
  }, [appRunDeps, jotaiStore])
}

export type NativeAppRun = ReturnType<ReturnType<typeof useAppRun>>
export type NativeCashuAppRun = Awaited<
  ReturnType<ReturnType<typeof useCashuAppRun>>
>
