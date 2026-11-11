// @vitest-environment jsdom
import { sqliteFalse, sqliteTrue } from "@evolu/common"
import {
  appBackgroundJobs,
  bankBackgroundJobs,
  cashuBackgroundJobs,
} from "@payky/core/background-jobs/background-jobs"
import { createStore, Provider } from "jotai"
import { act, Suspense } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
  AppBackgroundJobs,
  BankBackgroundJobs,
  CashuBackgroundJobs,
} from "@/components/app/app-background-jobs.tsx"

/**
 * What the components started and stopped, in order: `<group> started`
 * (`runBackgroundJobs`), `<group> stopped` when its jobs are disposed and
 * `<group> run disposed` when its run is.
 */
const state = vi.hoisted(() => ({
  native: false,
  events: [] as string[],
}))

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => state.native },
  CapacitorHttp: {},
}))

vi.mock("@payky/core/background-jobs/run-background-jobs", () => ({
  runBackgroundJobs: (jobs: ReadonlyArray<unknown>) => ({ jobs }),
}))

const groupOf = (jobs: ReadonlyArray<unknown>): string =>
  jobs === appBackgroundJobs
    ? "app"
    : jobs === bankBackgroundJobs
      ? "bank"
      : jobs === cashuBackgroundJobs
        ? "cashu"
        : "unknown"

/** A run whose `ok` "starts" the jobs it is handed and records it all. */
vi.mock("@evolu/web", () => ({
  createRun: () => {
    let group = "unknown"
    return {
      ok: async (task: { readonly jobs: ReadonlyArray<unknown> }) => {
        group = groupOf(task.jobs)
        state.events.push(`${group} started`)
        return {
          [Symbol.asyncDispose]: async () => {
            state.events.push(`${group} stopped`)
          },
        }
      },
      [Symbol.asyncDispose]: async () => {
        state.events.push(`${group} run disposed`)
      },
    }
  },
}))

/** The rows the device's `serviceProxySettingQuery` returns. */
const { serviceProxyRowsAtom } = await vi.hoisted(async () => {
  const { atom } = await import("jotai")
  return {
    serviceProxyRowsAtom: atom<
      ReadonlyArray<{ readonly serviceProxyEnabled: 0 | 1 | null }>
    >([{ serviceProxyEnabled: null }]),
  }
})

vi.mock("@/atoms/account.ts", async () => {
  const { atom } = await import("jotai")
  return {
    accountAtom: atom({
      id: "device-account",
      demo: null,
      masterKey: "master-key",
      device: { id: "device" },
    }),
  }
})
vi.mock("@/atoms/device-evolu.ts", async () => {
  const { atom } = await import("jotai")
  return { deviceEvoluAtom: atom({}) }
})
vi.mock("@/atoms/evolu.ts", async () => {
  const { atom } = await import("jotai")
  return {
    evoluAtom: atom({ appOwner: { id: "owner" } }),
    cashuShardStoreAtom: atom({}),
    cashuWalletDepAtom: atom({ cashuWallet: {} }),
  }
})
vi.mock("@/atoms/service-proxy.ts", async () => {
  const { atom } = await import("jotai")
  return { serviceProxyConsentAtom: atom(() => () => false) }
})
vi.mock("@/hooks/use-console.ts", () => ({
  useConsole: () => globalThis.console,
}))
vi.mock("@/hooks/use-device-evolu-query.ts", async () => {
  const { useAtomValue } = await import("jotai")
  return {
    useDeviceEvoluQuery: () => ({ data: useAtomValue(serviceProxyRowsAtom) }),
  }
})

const setServiceProxyEnabled = (
  store: ReturnType<typeof createStore>,
  enabled: boolean
) => {
  store.set(serviceProxyRowsAtom, [
    { serviceProxyEnabled: enabled ? sqliteTrue : sqliteFalse },
  ])
}

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("AppBackgroundJobs, CashuBackgroundJobs and BankBackgroundJobs", () => {
  let root: Root | null = null

  beforeEach(() => {
    state.events = []
    ;(
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(async () => {
    await act(async () => {
      root?.unmount()
    })
    root = null
  })

  const renderJobs = async (store: ReturnType<typeof createStore>) => {
    root = createRoot(document.createElement("div"))
    await act(async () => {
      root?.render(
        <Provider store={store}>
          <Suspense fallback={null}>
            <AppBackgroundJobs />
            <CashuBackgroundJobs />
            <BankBackgroundJobs />
          </Suspense>
        </Provider>
      )
    })
    await settle()
  }

  test("in a browser, toggling the service proxy starts and stops the bank jobs alone", async () => {
    state.native = false
    const store = createStore()
    await renderJobs(store)
    expect(state.events).toEqual(["app started", "cashu started"])

    await act(async () => {
      setServiceProxyEnabled(store, true)
    })
    await settle()
    expect(state.events).toEqual([
      "app started",
      "cashu started",
      "bank started",
    ])

    await act(async () => {
      setServiceProxyEnabled(store, false)
    })
    await settle()
    expect(state.events).toEqual([
      "app started",
      "cashu started",
      "bank started",
      "bank stopped",
      "bank run disposed",
    ])
  })

  test("in the native app, the bank jobs run and toggling the service proxy changes nothing", async () => {
    state.native = true
    const store = createStore()
    await renderJobs(store)
    const started = ["app started", "cashu started", "bank started"]
    expect([...state.events].sort()).toEqual([...started].sort())

    await act(async () => {
      setServiceProxyEnabled(store, true)
    })
    await settle()
    await act(async () => {
      setServiceProxyEnabled(store, false)
    })
    await settle()

    expect([...state.events].sort()).toEqual([...started].sort())
  })
})
