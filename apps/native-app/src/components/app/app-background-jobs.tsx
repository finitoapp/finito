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
import {
  Component,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
} from "react"
import { Platform } from "react-native"
import { accountAtom } from "../../atoms/account.ts"
import { appMigrationsAtom } from "../../atoms/app-migrations.ts"
import { cashuShardStoreAtom, cashuWalletDepAtom } from "../../atoms/cashu.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import { evoluAtom } from "../../atoms/evolu.ts"
import { qerkoConnectionStatusStore } from "../../atoms/qerko-connection-status.ts"
import { captureReportedError } from "../../core/error-reporting.ts"
import { nativeEnv } from "../../core/native-env.ts"
import { nativeConsole, nativeRun } from "../../core/native-runtime.ts"
import { eetNativeCrypto } from "../../platform/eet-crypto"
import { lockManager } from "../../platform/evolu-runtime"
import {
  createConnectivityDep,
  createFetchDep,
} from "../../platform/native-deps.ts"

/** The job context: the same effects web's `AppBackgroundJobs` passes. */
const createJobDeps = ({
  evolu,
  deviceId,
}: {
  readonly evolu: Evolu
  readonly deviceId: DeviceId
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
      {
        productionUrl: nativeEnv.EXPO_PUBLIC_PAYKY_EET_PRODUCTION_URL,
        playgroundUrl: nativeEnv.EXPO_PUBLIC_PAYKY_EET_PLAYGROUND_URL,
        native: eetNativeCrypto,
      }
    ),
    ...createQerkoApiDep({
      posId: nativeEnv.EXPO_PUBLIC_PAYKY_QERKO_POS_ID,
      baseUrl: nativeEnv.EXPO_PUBLIC_PAYKY_QERKO_BASE_URL,
    }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(qerkoConnectionStatusStore),
    // The one lock authority of this JS runtime, shared with `nativeRun`.
    lockManager,
    console: nativeConsole,
    onError: (error: unknown) => {
      nativeConsole.error("Background job failed.", error)
    },
  }
}

/**
 * Runs the jobs while mounted and stops them with the component. A demo
 * account's data is fictional and never syncs: no job runs there
 * (demo-data/0001). When the account switches, the old jobs are disposed
 * before the new ones start, so two accounts never hold job locks together.
 */
function useBackgroundJobs({
  isDemo,
  start,
}: {
  readonly isDemo: boolean
  /** The run the jobs live in and the jobs started in it; stable unless they must restart. */
  readonly start: () => {
    readonly run: AsyncDisposable
    readonly jobs: Promise<AsyncDisposable>
  }
}) {
  // Resolves once the previous effect's jobs and run are fully disposed.
  const stopped = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (isDemo) return

    let isDisposed = false
    const previousStopped = stopped.current
    const starting = (async () => {
      await previousStopped
      if (isDisposed) return null
      const { run, jobs } = start()
      try {
        const started = await jobs
        if (!isDisposed) return { run, jobs: started }
        await started[Symbol.asyncDispose]()
      } catch (error) {
        if (!isDisposed)
          nativeConsole.error("Failed to start background jobs.", error)
      }
      await run[Symbol.asyncDispose]()
      return null
    })()

    return () => {
      isDisposed = true
      stopped.current = (async () => {
        try {
          const running = await starting
          if (running === null) return
          await running.jobs[Symbol.asyncDispose]()
          await running.run[Symbol.asyncDispose]()
        } catch (error) {
          nativeConsole.error("Failed to stop background jobs.", error)
        }
      })()
    }
  }, [isDemo, start])
}

/**
 * The FIO, MONETA, Spark, EET, Qerko and Lightning address jobs (the banks
 * only in the APK): none of them reads the Cashu wallet.
 */
function AppBackgroundJobs() {
  const evolu = useAtomValue(evoluAtom)
  const account = useAtomValue(accountAtom)
  // Jobs start behind the data migrations, so none reads a half-migrated
  // database. A failed migration still lets them start, as on web.
  useAtomValue(appMigrationsAtom)

  const deviceId = account.device.id
  const start = useCallback(() => {
    const run = nativeRun.create(createJobDeps({ evolu, deviceId }))
    // The APK takes web's Capacitor branch, where FIO and MONETA have no
    // CORS limit; the PWA takes the browser's, which leaves both banks out,
    // as their settings screens already do there.
    return {
      run,
      jobs: run.ok(
        runBackgroundJobs(getBackgroundJobsForRuntime(Platform.OS !== "web"))
      ),
    }
  }, [evolu, deviceId])

  useBackgroundJobs({ isDemo: account.demo !== null, start })
  return null
}

/**
 * The Cashu job, apart from the others: it suspends on and throws from the
 * Cashu atoms alone, under its own boundary, so a Cashu wallet that fails to
 * start, or never does, stops no other job. An account switch restarts it on
 * the new account's store and wallet after the old run is disposed.
 */
function CashuBackgroundJobs() {
  const evolu = useAtomValue(evoluAtom)
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const cashuShardStore = useAtomValue(cashuShardStoreAtom)
  const cashuWalletDep = useAtomValue(cashuWalletDepAtom)
  useAtomValue(appMigrationsAtom)
  const deviceId = account.device.id
  const { masterKey } = account
  const start = useCallback(() => {
    const run = nativeRun.create({
      ...createJobDeps({ evolu, deviceId }),
      deviceEvolu,
      masterKey,
      ...createNostrDep(nativeEnv.EXPO_PUBLIC_PAYKY_NOSTR_RELAYS),
      cashuShardStore,
      ...cashuWalletDep,
    })
    return { run, jobs: run.ok(runBackgroundJobs(cashuBackgroundJobs)) }
  }, [cashuShardStore, cashuWalletDep, deviceEvolu, deviceId, evolu, masterKey])

  useBackgroundJobs({ isDemo: account.demo !== null, start })
  return null
}

/**
 * Renders nothing: a broken app Evolu client already shows on the screens that
 * need it, and the shell has to keep working without background sync. Still
 * reported, so it cannot vanish silently (the sanctioned twin of web's
 * `AppEvoluConsumersFailed`).
 */
class AppEvoluConsumersBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  // Like web's AppEvoluConsumersFailed: the error only, no component stack.
  override componentDidCatch(error: unknown) {
    captureReportedError(error)
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Isolated and suspended apart from the screens: losing it costs sync, not the UI. */
export function AppEvoluConsumers() {
  return (
    <AppEvoluConsumersBoundary>
      <Suspense fallback={null}>
        <AppBackgroundJobs />
      </Suspense>
    </AppEvoluConsumersBoundary>
  )
}

/** The Cashu job under a boundary and Suspense of its own, apart from `AppEvoluConsumers`. */
export function CashuEvoluConsumers() {
  return (
    <AppEvoluConsumersBoundary>
      <Suspense fallback={null}>
        <CashuBackgroundJobs />
      </Suspense>
    </AppEvoluConsumersBoundary>
  )
}
