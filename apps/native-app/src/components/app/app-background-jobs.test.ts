import { ok, sqliteFalse, sqliteTrue } from "@evolu/common"
import { createStore, Provider } from "jotai"
import { act, createElement, Fragment } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

/**
 * No React Native renderer runs in this suite, so the components render with
 * React DOM into a stand-in container: they draw nothing, and only their
 * effects — the job runs — are watched. The jobs, runs and atoms are fakes
 * that record what starts and stops.
 */
const fake = vi.hoisted(() => {
  const consentListeners = new Set<() => void>()
  return {
    os: "web" as "web" | "android",
    events: [] as string[],
    fetchDepOptions: [] as unknown[],
    consent: null as 0 | 1 | null,
    consentListeners,
    setConsent(value: 0 | 1 | null) {
      this.consent = value
      for (const listener of consentListeners) listener()
    },
  }
})

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return fake.os
    },
  },
}))

vi.mock("@payky/core/background-jobs/background-jobs", () => ({
  appBackgroundJobs: [{ group: "app" }],
  bankBackgroundJobs: [{ group: "bank" }],
  cashuBackgroundJobs: [{ group: "cashu" }],
  bankBackgroundJobsLockName: "bank-lock",
}))

vi.mock("@payky/core/background-jobs/run-background-jobs", () => {
  interface FakeRun {
    group?: string
  }
  const start =
    (jobs: ReadonlyArray<{ readonly group: string }>, how: string) =>
    (run: FakeRun) => {
      const group = jobs.map((job) => job.group).join()
      run.group = group
      fake.events.push(`start ${group}${how}`)
      return ok({
        [Symbol.asyncDispose]: async () => {
          fake.events.push(`stop ${group}`)
        },
      })
    }
  return {
    runBackgroundJobs: (jobs: ReadonlyArray<{ readonly group: string }>) =>
      start(jobs, ""),
    runBackgroundJobsHoldingLock: (
      lockName: string,
      jobs: ReadonlyArray<{ readonly group: string }>
    ) => start(jobs, ` holding ${lockName}`),
  }
})

vi.mock("../../core/native-runtime.ts", () => ({
  nativeConsole: { error: () => {}, debug: () => {} },
  nativeRun: {
    create: (deps: unknown) => {
      const run: {
        group?: string
        deps: unknown
        ok: (task: (run: unknown) => unknown) => Promise<unknown>
        [Symbol.asyncDispose]: () => Promise<void>
      } = {
        deps,
        ok: async (task) => {
          const result = (await task(run)) as
            | { ok: true; value: unknown }
            | { ok: false; error: unknown }
          if (!result.ok) throw result.error
          return result.value
        },
        [Symbol.asyncDispose]: async () => {
          fake.events.push(`dispose ${run.group ?? "?"} run`)
        },
      }
      return run
    },
  },
}))

vi.mock("../../platform/native-deps.ts", () => ({
  createFetchDep: (options: unknown) => {
    fake.fetchDepOptions.push(options)
    return { fetch: () => Promise.reject(new Error("no fetch in this test")) }
  },
  createConnectivityDep: () => ({}),
}))
vi.mock("../../platform/eet-crypto", () => ({ eetNativeCrypto: {} }))
vi.mock("../../platform/evolu-runtime", () => ({ lockManager: {} }))
vi.mock("../../core/error-reporting.ts", () => ({
  captureReportedError: (error: unknown) => {
    throw error
  },
}))
vi.mock("../../core/native-env.ts", () => ({ nativeEnv: {} }))
vi.mock("@payky/core/integrations/eet/eet-client", () => ({
  createEetApiDep: () => ({}),
}))
vi.mock("@payky/core/integrations/nostr/nostr-client", () => ({
  createNostrDep: () => ({}),
}))
vi.mock("@payky/core/integrations/qerko/qerko-client", () => ({
  createQerkoApiDep: () => ({}),
}))
vi.mock("@payky/core/integrations/qerko/qerko-connection-status", () => ({
  createQerkoConnectionStatusDep: () => ({}),
}))
vi.mock("@payky/core/integrations/qerko/qerko-socket", () => ({
  createQerkoSocketDep: () => ({}),
}))

const deviceEvolu = vi.hoisted(() => ({ name: "device" }))
vi.mock("../../atoms/account.ts", async () => {
  const { atom } = await import("jotai")
  return {
    accountAtom: atom({
      id: "device-account-1",
      device: { id: "device-1" },
      demo: null,
      masterKey: "master-key",
    }),
  }
})
vi.mock("../../atoms/app-migrations.ts", async () => {
  const { atom } = await import("jotai")
  return { appMigrationsAtom: atom(null) }
})
vi.mock("../../atoms/cashu.ts", async () => {
  const { atom } = await import("jotai")
  return { cashuShardStoreAtom: atom({}), cashuWalletDepAtom: atom({}) }
})
vi.mock("../../atoms/device-evolu.ts", async () => {
  const { atom } = await import("jotai")
  return { deviceEvoluAtom: atom(deviceEvolu) }
})
vi.mock("../../atoms/evolu.ts", async () => {
  const { atom } = await import("jotai")
  return { evoluAtom: atom({ appOwner: {} }) }
})
vi.mock("../../atoms/notifications.ts", async () => {
  const { atom } = await import("jotai")
  return { notificationStoreAtom: atom({ notifications: {} }) }
})
vi.mock("../../atoms/qerko-connection-status.ts", () => ({
  qerkoConnectionStatusStore: {},
}))

// The consent row of the device database, as `useCanReachBanks` reads it.
vi.mock("../../hooks/use-evolu-query.ts", async () => {
  const { useSyncExternalStore } = await import("react")
  return {
    useDeviceEvoluQuery: () => {
      const serviceProxyEnabled = useSyncExternalStore(
        (listener) => {
          fake.consentListeners.add(listener)
          return () => fake.consentListeners.delete(listener)
        },
        () => fake.consent
      )
      return { data: [{ id: "settings", serviceProxyEnabled }] }
    },
  }
})

import {
  AppEvoluConsumers,
  CashuEvoluConsumers,
} from "./app-background-jobs.tsx"

/**
 * What React DOM touches of the page, a container and its document to render
 * nothing: no DOM runs in this suite.
 */
const fakeWindow = {
  event: undefined,
  document: { activeElement: null },
  HTMLIFrameElement: class {},
}
const createContainer = () => {
  const noop = () => {}
  const document = {
    nodeType: 9,
    defaultView: fakeWindow,
    addEventListener: noop,
    removeEventListener: noop,
  }
  return {
    nodeType: 1,
    nodeName: "DIV",
    tagName: "DIV",
    namespaceURI: "http://www.w3.org/1999/xhtml",
    ownerDocument: document,
    addEventListener: noop,
    removeEventListener: noop,
  }
}

const reactActEnvironment = globalThis as {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

let root: Root | null = null

const renderJobs = async () => {
  const store = createStore()
  root = createRoot(createContainer() as unknown as Element)
  await act(async () => {
    root?.render(
      createElement(
        Provider,
        { store },
        createElement(
          Fragment,
          null,
          createElement(AppEvoluConsumers),
          createElement(CashuEvoluConsumers)
        )
      )
    )
  })
}

const setConsent = async (value: 0 | 1 | null) => {
  await act(async () => {
    fake.setConsent(value)
  })
}

describe("app background jobs and the service proxy consent", () => {
  beforeEach(() => {
    vi.stubGlobal("window", fakeWindow)
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    fake.os = "web"
    fake.events = []
    fake.fetchDepOptions = []
    fake.consent = null
  })

  afterEach(async () => {
    await act(async () => {
      root?.unmount()
    })
    root = null
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false
    vi.unstubAllGlobals()
  })

  test("in the PWA, turning the consent on and off starts and stops the bank jobs alone", async () => {
    await renderJobs()
    await vi.waitFor(() => {
      expect(fake.events).toEqual(["start app", "start cashu"])
    })
    // The fetch asks for the consent itself; the job deps never carry it.
    for (const options of fake.fetchDepOptions) {
      expect(options).toEqual({ deviceEvolu })
    }

    await setConsent(sqliteTrue)
    await vi.waitFor(() => {
      expect(fake.events.slice(2)).toEqual(["start bank holding bank-lock"])
    })

    await setConsent(sqliteFalse)
    await vi.waitFor(() => {
      expect(fake.events.slice(3)).toEqual(["stop bank", "dispose bank run"])
    })

    await setConsent(sqliteTrue)
    await vi.waitFor(() => {
      expect(fake.events.slice(5)).toEqual(["start bank holding bank-lock"])
    })

    // The app and Cashu jobs started once and were never stopped.
    expect(fake.events.filter((event) => /app|cashu/u.test(event))).toEqual([
      "start app",
      "start cashu",
    ])
  })

  test("in the APK, the bank jobs run from the start and the consent changes nothing", async () => {
    fake.os = "android"
    await renderJobs()
    await vi.waitFor(() => {
      expect([...fake.events].sort()).toEqual([
        "start app",
        "start bank",
        "start cashu",
      ])
    })

    await setConsent(sqliteTrue)
    await setConsent(sqliteFalse)
    await setConsent(null)
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(fake.events).toHaveLength(3)
  })
})
