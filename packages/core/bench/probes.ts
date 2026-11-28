import { createConsole, type MutationOptions } from "@evolu/common"
import {
  NonNegativeInteger,
  PositiveNumber,
} from "../src/modules/shared/schema.ts"

export const BENCH_AMOUNT_CZK = NonNegativeInteger(12_900)
export const BENCH_EXCHANGE_RATE = PositiveNumber(1_500_000)
export const BENCH_AMOUNT_SATS = NonNegativeInteger(8_600)

export const silentConsole = createConsole({ level: "silent" })
export const realDate = { date: { now: () => new Date() } }

export const now = (): number => performance.now()

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export const waitFor = async <T>(
  label: string,
  read: () => T | null | undefined,
  timeoutMs = 90_000
): Promise<T> => {
  const deadline = now() + timeoutMs
  for (;;) {
    const value = read()
    if (value !== null && value !== undefined) return value
    if (now() > deadline) throw new Error(`Timed out waiting for ${label}`)
    await sleep(2)
  }
}

export interface HttpCall {
  readonly at: number
  doneAt: number | null
  readonly endpoint: string
  readonly quoteId: string | null
  readonly signalled: boolean
}

export interface WriteRecord {
  readonly at: number
  readonly db: "app" | "device"
  readonly batch: (() => void) | null
}

export interface ProofScanRecord {
  readonly at: number
  readonly ms: number
}

export interface Probes {
  readonly http: HttpCall[]
  readonly writes: WriteRecord[]
  readonly proofScans: ProofScanRecord[]
  readonly sweeps: Array<{ readonly at: number }>
  readonly claimedAt: Map<string, number>
}

export const createProbes = (): Probes => ({
  http: [],
  writes: [],
  proofScans: [],
  sweeps: [],
  claimedAt: new Map(),
})

export const between = <T extends { readonly at: number }>(
  items: ReadonlyArray<T>,
  from: number,
  to: number
): ReadonlyArray<T> => items.filter(({ at }) => at >= from && at <= to)

const parseCallMeta = (input: RequestInfo | URL, init?: RequestInit) => {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  const method =
    init?.method ??
    (typeof input === "object" && "method" in input ? input.method : "GET")
  const url = new URL(rawUrl)
  const quoteId =
    /\/v1\/mint\/quote\/bolt11\/(.+)$/u.exec(url.pathname)?.[1] ?? null
  const normalizedPath = url.pathname.replace(
    /(\/v1\/mint\/quote\/bolt11)\/.+$/u,
    "$1/:id"
  )
  const endpoint =
    url.hostname === "api.yadio.io"
      ? `yadio ${method} ${normalizedPath}`
      : `mint ${method} ${normalizedPath}`
  return { endpoint, quoteId }
}

export const withRoundTrip =
  (
    probes: Probes,
    rttMs: number,
    upstream: typeof globalThis.fetch
  ): typeof globalThis.fetch =>
  async (input, init) => {
    const { endpoint, quoteId } = parseCallMeta(input, init)
    const call: HttpCall = {
      at: now(),
      doneAt: null,
      endpoint,
      quoteId,
      signalled: init?.signal !== undefined && init.signal !== null,
    }
    probes.http.push(call)
    await sleep(rttMs)
    const response = await upstream(input, init)
    call.doneAt = now()
    return response
  }

export const yadioFetch: typeof globalThis.fetch = async () =>
  new Response(
    JSON.stringify({ BTC: Number(BENCH_EXCHANGE_RATE), timestamp: Date.now() })
  )

interface InstrumentedEvolu {
  readonly upsert: unknown
  readonly update: unknown
  readonly insert: unknown
  readonly loadQuery: unknown
}

/**
 * Wraps an Evolu client in place to record write batches, reconciliationClaim
 * completion times, and full wallet proof scans without changing core code.
 */
export const instrumentEvolu = (
  probes: Probes,
  db: "app" | "device",
  evolu: InstrumentedEvolu,
  proofScanQuery: string | null
): void => {
  const wrapWrite =
    (write: (...args: ReadonlyArray<unknown>) => unknown) =>
    (
      table: string,
      values: Record<string, unknown>,
      options?: MutationOptions
    ) => {
      const onComplete = options?.onComplete ?? null
      probes.writes.push({ at: now(), db, batch: onComplete })
      const paymentId = values.paymentId
      if (table !== "reconciliationClaim" || typeof paymentId !== "string")
        return write(table, values, options)
      if (onComplete === null) {
        if (!probes.claimedAt.has(paymentId))
          probes.claimedAt.set(paymentId, now())
        return write(table, values, options)
      }
      return write(table, values, {
        ...options,
        onComplete: () => {
          if (!probes.claimedAt.has(paymentId))
            probes.claimedAt.set(paymentId, now())
          onComplete()
        },
      })
    }

  const methods = evolu as unknown as Record<
    keyof InstrumentedEvolu,
    (...args: ReadonlyArray<unknown>) => unknown
  >
  const loadQuery = methods.loadQuery.bind(evolu)
  Object.assign(evolu, {
    upsert: wrapWrite(methods.upsert.bind(evolu)),
    update: wrapWrite(methods.update.bind(evolu)),
    insert: wrapWrite(methods.insert.bind(evolu)),
    loadQuery: async (query: string) => {
      const at = now()
      const rows = await loadQuery(query)
      if (query === proofScanQuery)
        probes.proofScans.push({ at, ms: now() - at })
      return rows
    },
  })
}

export interface WriteBatchCounts {
  readonly app: number
  readonly device: number
}

/**
 * `runMutationWithCompletion` passes the same `onComplete` callback to every
 * mutation in a batch, so distinct callbacks equal distinct write batches.
 */
export const countWriteBatches = (
  probes: Probes,
  from: number,
  to: number
): WriteBatchCounts => {
  const count = (db: "app" | "device") => {
    const callbacks = new Set<() => void>()
    let unbatched = 0
    for (const write of between(probes.writes, from, to)) {
      if (write.db !== db) continue
      if (write.batch === null) unbatched += 1
      else callbacks.add(write.batch)
    }
    return callbacks.size + unbatched
  }
  return { app: count("app"), device: count("device") }
}

export const tallyCalls = (calls: ReadonlyArray<HttpCall>): string => {
  const counts = new Map<string, number>()
  for (const { endpoint } of calls)
    counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1)
  return [...counts]
    .map(([endpoint, count]) => `${count}x ${endpoint.replace(/^mint /u, "")}`)
    .join(", ")
}
