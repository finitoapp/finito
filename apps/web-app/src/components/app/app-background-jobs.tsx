import { Capacitor } from "@capacitor/core"
import { createRun } from "@evolu/web"
import {
  cashuBackgroundJobs,
  getBackgroundJobsForRuntime,
} from "@payky/core/background-jobs/background-jobs"
import { runBackgroundJobs } from "@payky/core/background-jobs/run-background-jobs"
import { createDateDep } from "@payky/core/deps"
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
import { qerkoConnectionStatusStore } from "@/atoms/qerko-connection-status.ts"
import { appEnv } from "@/core/app-env.ts"
import { useConsole } from "@/hooks/use-console.ts"
import {
  createConnectivityDep,
  createFetchDep,
} from "@/platform/platform-deps.ts"

type Console = ReturnType<typeof useConsole>

/** The app's own job context, without the Cashu wallet. */
const createAppJobDeps = ({
  evolu,
  deviceId,
  console,
}: {
  readonly evolu: Evolu
  readonly deviceId: DeviceId
  readonly console: Console
}) => {
  const dateDep = createDateDep()
  const fetchDep = createFetchDep()
  return {
    evolu,
    evoluOwner: evolu.appOwner,
    deviceId,
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

/** The FIO, Spark and EET jobs: none of them reads the Cashu wallet. */
export function AppBackgroundJobs() {
  const evolu = useAtomValue(evoluAtom)
  const account = useAtomValue(accountAtom)
  const console = useConsole()
  const deviceId = account.device.id
  const start = useCallback(() => {
    const run = createRun(createAppJobDeps({ evolu, deviceId, console }))
    return {
      run,
      jobs: run.ok(
        runBackgroundJobs(
          getBackgroundJobsForRuntime(Capacitor.isNativePlatform())
        )
      ),
    }
  }, [console, deviceId, evolu])

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
  const console = useConsole()
  const deviceId = account.device.id
  const { masterKey } = account
  const start = useCallback(() => {
    const run = createRun({
      ...createAppJobDeps({ evolu, deviceId, console }),
      deviceEvolu,
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
    deviceEvolu,
    deviceId,
    evolu,
    masterKey,
  ])

  useBackgroundJobs({ isDemo: account.demo !== null, console, start })

  return null
}
