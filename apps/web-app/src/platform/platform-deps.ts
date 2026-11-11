import {
  Capacitor,
  CapacitorHttp,
  type HttpHeaders,
  type HttpOptions,
} from "@capacitor/core"
import type { ConnectivityDep, FetchDep } from "@payky/core/deps"
import { createServiceProxyFetch } from "@payky/core/integrations/service-proxy/service-proxy-fetch"
import { apiUrl } from "@/core/app-env.ts"

const getRequestHeaders = (request: Request): HttpHeaders => {
  const headers: HttpHeaders = {}

  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  return headers
}

const getRequestData = async (
  request: Request
): Promise<Pick<HttpOptions, "data">> => {
  if (request.method === "GET" || request.method === "HEAD") return {}

  const data = await request.clone().text()

  return data.length > 0 ? { data } : {}
}

const createResponseBody = (data: unknown): BodyInit | null => {
  if (data === null || data === undefined) return null
  if (typeof data === "string") return data
  if (data instanceof Blob) return data
  if (data instanceof ArrayBuffer) return data
  if (
    typeof data === "number" ||
    typeof data === "boolean" ||
    typeof data === "bigint"
  ) {
    return data.toString()
  }

  return JSON.stringify(data)
}

const getAbortReason = (signal: AbortSignal): unknown =>
  signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError")

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw getAbortReason(signal)
}

/**
 * `CapacitorHttp.request` cannot be cancelled, so an abort mid-request has to
 * be raced against it — otherwise a caller enforcing its own timeout through
 * the signal (the EET client does) waits for as long as the connection stalls.
 * The native request itself runs on and its late answer is dropped.
 */
const raceAbort = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(getAbortReason(signal))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    void promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort)
    })
  })

/**
 * Backstop for requests that pass no signal: Android's `HttpURLConnection`
 * defaults to no connect or read timeout at all.
 */
const nativeHttpTimeoutMs = 30_000

const capacitorFetch: typeof globalThis.fetch = async (input, init) => {
  const request = new Request(input, init)
  throwIfAborted(request.signal)

  const requestData = await getRequestData(request)

  throwIfAborted(request.signal)

  const response = await raceAbort(
    CapacitorHttp.request({
      url: request.url,
      method: request.method,
      headers: getRequestHeaders(request),
      responseType: "text",
      connectTimeout: nativeHttpTimeoutMs,
      readTimeout: nativeHttpTimeoutMs,
      ...requestData,
    }),
    request.signal
  )

  return new Response(createResponseBody(response.data), {
    status: response.status,
    headers: response.headers,
  })
}

/**
 * The app's fetch. The native app calls through `CapacitorHttp`, which knows
 * no CORS, so it reaches every service directly. A browser sends the calls
 * to services that answer no CORS preflight (Fio, MONETA) through the app's
 * own proxy while `isServiceProxyEnabled()` says this device allowed it —
 * asked at each request, so pass a stable reader (`serviceProxyConsentAtom`),
 * never a captured value. Left out, the proxy stays off: right only where no
 * call reaches a proxied service.
 */
export const createFetchDep = ({
  isServiceProxyEnabled = () => false,
}: {
  readonly isServiceProxyEnabled?: (() => boolean) | undefined
} = {}): FetchDep => {
  const browserFetch = createServiceProxyFetch({
    fetch: (...args) => globalThis.fetch(...args),
    apiBaseUrl: apiUrl("/"),
    isEnabled: isServiceProxyEnabled,
  })

  return {
    fetch: async (...args) => {
      if (Capacitor.isNativePlatform()) {
        return capacitorFetch(...args)
      }

      return await browserFetch(...args)
    },
  }
}

export const createConnectivityDep = (): ConnectivityDep => ({
  connectivity: {
    onOnline: (listener) => {
      globalThis.addEventListener("online", listener)
      return () => {
        globalThis.removeEventListener("online", listener)
      }
    },
  },
})
