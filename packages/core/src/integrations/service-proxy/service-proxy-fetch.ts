import {
  findProxiedServiceForUrl,
  type ProxiedService,
  proxiedServices,
  SERVICE_PROXY_ERROR_HEADER,
  SERVICE_PROXY_PATH_HEADER,
  serviceProxyEndpointPath,
} from "./service-proxy-services.ts"

/**
 * The proxy failed the request itself — an unknown service, a refused path or
 * origin, an unreachable upstream — so there is no answer of the service to
 * read. Thrown as a network failure, so `appFetchAsText` turns it into a
 * `FetchError` and no client takes it for the service refusing its token.
 */
export class ServiceProxyError extends Error {
  override readonly name = "ServiceProxyError"
  readonly service: ProxiedService
  readonly status: number
  /** The proxy's reason, from its `x-service-proxy-error` header. */
  readonly reason: string

  constructor({
    service,
    status,
    reason,
  }: {
    readonly service: ProxiedService
    readonly status: number
    readonly reason: string
  }) {
    super(`The ${service} service proxy failed with HTTP ${status}: ${reason}.`)
    this.service = service
    this.status = status
    this.reason = reason
  }
}

/**
 * A fetch that sends calls to the services of `proxiedServices` through the
 * app's own proxy at `apiBaseUrl` while `isEnabled()` says the device allowed
 * it, and every other call unchanged.
 *
 * `isEnabled` is asked at each call, never captured, so turning the consent
 * on or off takes effect without recreating anything that holds this fetch.
 * A proxied call goes out as a `GET` to `/api/proxy/<service>` with the
 * upstream path and query in `x-proxy-path` — never in the URL, where a Fio
 * token would end up in access logs — and only the request headers the
 * service lets through.
 */
export const createServiceProxyFetch = ({
  fetch,
  apiBaseUrl,
  isEnabled,
}: {
  readonly fetch: typeof globalThis.fetch
  readonly apiBaseUrl: string
  readonly isEnabled: () => boolean
}): typeof globalThis.fetch => {
  const proxyFetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : null
    const href = request?.url ?? input.toString()
    // A relative URL parses to no service and goes out untouched.
    const service = findProxiedServiceForUrl(href)
    if (service === null || !isEnabled()) return await fetch(input, init)
    const url = new URL(href)

    const method = (init?.method ?? request?.method ?? "GET").toUpperCase()
    const body = init?.body ?? request?.body ?? null
    if (method !== "GET" || body !== null) {
      throw new TypeError(
        `The ${service} service proxy passes on bodiless GET requests only, not this ${method}.`
      )
    }

    const sourceHeaders = new Headers(request?.headers)
    new Headers(init?.headers).forEach((value, name) => {
      sourceHeaders.set(name, value)
    })
    const headers = new Headers()
    for (const name of proxiedServices[service].requestHeaders) {
      const value = sourceHeaders.get(name)
      if (value !== null) headers.set(name, value)
    }
    headers.set(SERVICE_PROXY_PATH_HEADER, `${url.pathname}${url.search}`)

    const signal = init?.signal ?? request?.signal ?? null
    const response = await fetch(
      new URL(serviceProxyEndpointPath(service), apiBaseUrl),
      { method: "GET", headers, signal }
    )

    const reason = response.headers.get(SERVICE_PROXY_ERROR_HEADER)
    if (reason === null) return response

    await response.body?.cancel().catch(() => undefined)
    signal?.throwIfAborted()
    throw new ServiceProxyError({ service, status: response.status, reason })
  }

  return proxyFetch
}
