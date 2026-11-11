import { createRun } from "@evolu/web"
import { createDateDep } from "@payky/core/deps"
import { createEetApiDep } from "@payky/core/integrations/eet/eet-client"
import { createNostrDep } from "@payky/core/integrations/nostr/nostr-client"
import { createQerkoApiDep } from "@payky/core/integrations/qerko/qerko-client"
import { createYadioApiDep } from "@payky/core/integrations/yadio/yadio-client"
import { createSparkWalletDep } from "@payky/core/spark/spark-wallet"
import { useAtomValue, useStore } from "jotai"
import { useCallback, useMemo } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { cashuShardStoreAtom, cashuWalletDepAtom } from "@/atoms/evolu.ts"
import { serviceProxyConsentAtom } from "@/atoms/service-proxy.ts"
import { appEnv } from "@/core/app-env.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useEvolu } from "@/hooks/use-evolu.ts"
import { createE2eSparkWalletDep } from "@/platform/e2e-spark-wallet.ts"
import { createFetchDep } from "@/platform/platform-deps.ts"
import { createSwitchioTerminalDep } from "@/platform/switchio.ts"

/**
 * Composition root for running Task actions from React.
 *
 * Returns a stable factory that creates a disposable Run wired with the full
 * superset of app dependencies (console, evolu, deviceEvolu, evoluOwner,
 * date, fetch, sparkWallet, yadioApi, qerkoApi, switchioTerminal, eetApi, nostr,
 * lockManager); the Cashu wallet comes from `useCashuAppRun`. Task
 * dependency typing is structural, so Tasks that need only a subset are
 * unaffected by the extra deps.
 *
 * ### Example
 *
 * ```tsx
 * const appRun = useAppRun()
 *
 * const handleSubmit = async () => {
 *   await using run = appRun()
 *   const result = await run(someAction(...))
 *   // or several sequential calls: await run.orThrow(otherAction(...))
 * }
 * ```
 */
/** Every app dependency but the Cashu ones, built fresh for each run. */
const useAppRunDeps = () => {
  const console = useConsole()
  const evolu = useEvolu()
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  // Stable for the session: the fetch asks it at each call, so turning the
  // consent on or off recreates nothing here.
  const isServiceProxyEnabled = useAtomValue(serviceProxyConsentAtom)
  const demo = account.demo !== null

  return useCallback(() => {
    const dateDep = createDateDep()
    const fetchDep = createFetchDep({ isServiceProxyEnabled })

    return {
      console,
      evolu,
      deviceEvolu,
      evoluOwner: evolu.appOwner,
      masterKey: account.masterKey,
      lockManager: navigator.locks,
      ...dateDep,
      ...fetchDep,
      ...(createE2eSparkWalletDep() ?? createSparkWalletDep()),
      ...createYadioApiDep(),
      ...createQerkoApiDep({ posId: appEnv.VITE_PAYKY_QERKO_POS_ID }),
      uuid: { create: () => crypto.randomUUID() },
      ...createSwitchioTerminalDep({ demo }),
      ...createEetApiDep(
        { ...dateDep, ...fetchDep },
        { productionUrl: appEnv.VITE_PAYKY_EET_PRODUCTION_URL }
      ),
      ...createNostrDep(appEnv.VITE_PAYKY_NOSTR_RELAYS),
    }
  }, [
    account.masterKey,
    console,
    demo,
    deviceEvolu,
    evolu,
    isServiceProxyEnabled,
  ])
}

export const useAppRun = () => {
  const appRunDeps = useAppRunDeps()
  return useMemo(() => () => createRun(appRunDeps()), [appRunDeps])
}

/**
 * `useAppRun` plus the shared Cashu wallet (`cashuShardStore`, `cashuWallet`),
 * for the Cashu actions only: `await using run = await cashuAppRun()`. The
 * Cashu atoms are read when a run is made, never while rendering, so a
 * wallet that fails to start, or never does, holds up no screen; the call
 * that needed it rejects instead.
 */
export const useCashuAppRun = () => {
  const appRunDeps = useAppRunDeps()
  const jotaiStore = useStore()
  return useCallback(async () => {
    const [cashuShardStore, cashuWalletDep] = await Promise.all([
      jotaiStore.get(cashuShardStoreAtom),
      jotaiStore.get(cashuWalletDepAtom),
    ])
    return createRun({ ...appRunDeps(), cashuShardStore, ...cashuWalletDep })
  }, [appRunDeps, jotaiStore])
}
