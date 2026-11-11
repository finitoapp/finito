import { createRun } from "@evolu/web"
import {
  appBackgroundJobs,
  bankBackgroundJobs,
  cashuBackgroundJobs,
} from "@payky/core/background-jobs/background-jobs"
import type { NotificationStore } from "@payky/core/background-jobs/notifications"
import { runBackgroundJobs } from "@payky/core/background-jobs/run-background-jobs"
import { createDateDep } from "@payky/core/deps"
import type {
  DeviceAccountId,
  DeviceEvolu,
} from "@payky/core/evolu/device-client"
import type { Evolu } from "@payky/core/evolu/schema"
import { createEetApiDep } from "@payky/core/integrations/eet/eet-client"
import { createNostrDep } from "@payky/core/integrations/nostr/nostr-client"
import { createQerkoApiDep } from "@payky/core/integrations/qerko/qerko-client"
import { createQerkoConnectionStatusDep } from "@payky/core/integrations/qerko/qerko-connection-status"
import { createQerkoSocketDep } from "@payky/core/integrations/qerko/qerko-socket"
import type { DeviceId } from "@payky/core/modules/device/device-types"
import { useAtomValue } from "jotai"
import { useCallback, useEffect } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import {
  cashuShardStoreAtom,
  cashuWalletDepAtom,
  evoluAtom,
} from "@/atoms/evolu.ts"
import { notificationStoreAtom } from "@/atoms/notifications.ts"
import { qerkoConnectionStatusStore } from "@/atoms/qerko-connection-status.ts"
import { serviceProxyConsentAtom } from "@/atoms/service-proxy.ts"
import { appEnv } from "@/core/app-env.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useCanReachBanks } from "@/hooks/use-service-proxy.ts"
import {
  createConnectivityDep,
  createFetchDep,
} from "@/platform/platform-deps.ts"

type Console = ReturnType<typeof useConsole>

/**
 * The app's own job context, without the Cashu wallet. Only the bank jobs
 * pass `isServiceProxyEnabled`: no other job calls a proxied service, and
 * leaving the consent out of the others' context keeps them from depending
 * on it in any way.
 */
const createAppJobDeps = ({
  evolu,
  deviceEvolu,
  deviceAccountId,
  deviceId,
  notificationStore,
  console,
  isServiceProxyEnabled,
}: {
  readonly evolu: Evolu
  readonly deviceEvolu: DeviceEvolu
  readonly deviceAccountId: DeviceAccountId
  readonly deviceId: DeviceId
  readonly notificationStore: NotificationStore
  readonly console: Console
  readonly isServiceProxyEnabled?: (() => boolean) | undefined
}) => {
  const dateDep = createDateDep()
  const fetchDep = createFetchDep({ isServiceProxyEnabled })
  return {
    evolu,
    evoluOwner: evolu.appOwner,
    deviceEvolu,
    deviceAccountId,
    deviceId,
    notifications: notificationStore.notifications,
    ...dateDep,
    ...fetchDep,
    ...createConnectivityDep(),
    ...createEetApiDep(
      { ...dateDep, ...fetchDep },
      { productionUrl: appEnv.VITE_PAYKY_EET_PRODUCTION_URL }
    ),
    ...createQerkoApiDep({ posId: appEnv.VITE_PAYKY_QERKO_POS_ID }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(qerkoConnectionStatusStore),
    lockManager: navigator.locks,
    console,
    onError: (error: unknown) => {
      console.error("Background job failed.", error)
    },
  }
}

/**
 * Runs what `start` starts, and stops it with the component. Every job talks
 * to an outside service, and a demo account's data is fictional: none may
 * run there (demo-data/0001).
 */
const useBackgroundJobs = ({
  isDemo,
  console,
  start,
}: {
  readonly isDemo: boolean
  readonly console: Console
  /** The run the jobs live in and the jobs started in it; stable unless they must restart. */
  readonly start: () => {
    readonly run: AsyncDisposable
    readonly jobs: Promise<AsyncDisposable>
  }
}) => {
  useEffect(() => {
    if (isDemo) return

    let isDisposed = false
    let jobsDisposable: AsyncDisposable | null = null
    const { run, jobs } = start()

    const startJobs = async (): Promise<void> => {
      try {
        const startedJobsDisposable = await jobs
        if (isDisposed) {
          await startedJobsDisposable[Symbol.asyncDispose]()
          return
        }

        jobsDisposable = startedJobsDisposable
      } catch (error) {
        if (!isDisposed) {
          console.error("Failed to start background jobs.", error)
        }
      }
    }
    const startingJobs = startJobs()

    return () => {
      isDisposed = true
      void (async () => {
        try {
          await startingJobs
          if (jobsDisposable !== null)
            await jobsDisposable[Symbol.asyncDispose]()
          await run[Symbol.asyncDispose]()
        } catch (error) {
          console.error("Failed to stop background jobs.", error)
        }
      })()
    }
  }, [console, isDemo, start])
}

/**
 * The app's jobs (`appBackgroundJobs`: Spark, EET, Qerko, ...), the same in
 * the native app and a browser. Neither the Cashu wallet nor the consent to
 * the service proxy is read here, so turning that consent on or off never
 * restarts them; the banks' jobs are `BankBackgroundJobs`.
 */
export function AppBackgroundJobs() {
  const evolu = useAtomValue(evoluAtom)
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const notificationStore = useAtomValue(notificationStoreAtom)
  const console = useConsole()
  const deviceId = account.device.id
  const deviceAccountId = account.id
  const start = useCallback(() => {
    const run = createRun(
      createAppJobDeps({
        evolu,
        deviceEvolu,
        deviceAccountId,
        deviceId,
        notificationStore,
        console,
      })
    )
    return {
      run,
      jobs: run.ok(runBackgroundJobs(appBackgroundJobs)),
    }
  }, [
    console,
    deviceAccountId,
    deviceEvolu,
    deviceId,
    evolu,
    notificationStore,
  ])

  useBackgroundJobs({ isDemo: account.demo !== null, console, start })

  return null
}

/**
 * The Cashu job, apart from the others: it suspends on and throws from the
 * Cashu atoms alone, under its own boundary in `App.tsx`, so a Cashu wallet
 * that fails to start, or never does, stops no other job.
 */
export function CashuBackgroundJobs() {
  const evolu = useAtomValue(evoluAtom)
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const cashuShardStore = useAtomValue(cashuShardStoreAtom)
  const cashuWalletDep = useAtomValue(cashuWalletDepAtom)
  const notificationStore = useAtomValue(notificationStoreAtom)
  const console = useConsole()
  const deviceId = account.device.id
  const deviceAccountId = account.id
  const { masterKey } = account
  const start = useCallback(() => {
    const run = createRun({
      ...createAppJobDeps({
        evolu,
        deviceEvolu,
        deviceAccountId,
        deviceId,
        notificationStore,
        console,
      }),
      masterKey,
      ...createNostrDep(appEnv.VITE_PAYKY_NOSTR_RELAYS),
      cashuShardStore,
      ...cashuWalletDep,
    })
    return { run, jobs: run.ok(runBackgroundJobs(cashuBackgroundJobs)) }
  }, [
    cashuShardStore,
    cashuWalletDep,
    console,
    deviceAccountId,
    deviceEvolu,
    deviceId,
    evolu,
    masterKey,
    notificationStore,
  ])

  useBackgroundJobs({ isDemo: account.demo !== null, console, start })

  return null
}

/**
 * The Fio and MONETA jobs (`bankBackgroundJobs`), apart from the others:
 * mounted only while this device can reach the banks (`useCanReachBanks`) —
 * natively, or in a browser through the service proxy it allowed — so turning
 * that consent on or off starts or stops them alone. Under its own boundary
 * in `App.tsx`, since it suspends on the consent.
 */
export function BankBackgroundJobs() {
  const canReachBanks = useCanReachBanks()
  return canReachBanks ? <RunningBankBackgroundJobs /> : null
}

/**
 * Runs the bank jobs while mounted. In a browser every open tab with the
 * consent on runs them, as another device would (service-proxy/0001): no
 * lock elects one tab, since a backgrounded or frozen tab could keep holding
 * it and starve the visible one.
 */
function RunningBankBackgroundJobs() {
  const evolu = useAtomValue(evoluAtom)
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const notificationStore = useAtomValue(notificationStoreAtom)
  const isServiceProxyEnabled = useAtomValue(serviceProxyConsentAtom)
  const console = useConsole()
  const deviceId = account.device.id
  const deviceAccountId = account.id
  const start = useCallback(() => {
    const run = createRun(
      createAppJobDeps({
        evolu,
        deviceEvolu,
        deviceAccountId,
        deviceId,
        notificationStore,
        console,
        isServiceProxyEnabled,
      })
    )
    return {
      run,
      jobs: run.ok(runBackgroundJobs(bankBackgroundJobs)),
    }
  }, [
    console,
    deviceAccountId,
    deviceEvolu,
    deviceId,
    evolu,
    isServiceProxyEnabled,
    notificationStore,
  ])

  useBackgroundJobs({ isDemo: account.demo !== null, console, start })

  return null
}
