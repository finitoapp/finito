/**
 * The services a browser reaches through the app's own proxy because they
 * answer no CORS preflight, and exactly what of each the proxy passes on.
 * The browser's fetch wrapper (`service-proxy-fetch.ts`) and the server
 * handler read this one registry, and the bank clients take their base URLs
 * from it, so the three cannot drift apart.
 */

export interface ProxiedServiceConfig {
  /** The one origin the proxy calls for the service. */
  readonly origin: string
  /**
   * The path and query (`pathname + search`, after URL normalization) of
   * every call the service's client makes; nothing else is passed on.
   */
  readonly paths: RegExp
  /** The request headers passed on, lowercase. */
  readonly requestHeaders: ReadonlyArray<string>
}

/** A Fio token or a MONETA account id: one path segment, nothing more. */
const segment = "[^/?#]+"
const date = "\\d{4}-\\d{2}-\\d{2}"

export const proxiedServices = {
  /** Fio's API, the calls `fio-client.ts` makes; the token is in the path. */
  fio: {
    origin: "https://fioapi.fio.cz",
    paths: new RegExp(
      `^/v1/rest/(?:last/${segment}/transactions\\.json|periods/${segment}/${date}/${date}/transactions\\.json|set-last-date/${segment}/${date}/)$`,
      "u"
    ),
    requestHeaders: ["accept"],
  },
  /**
   * MONETA's VIP API, the calls `moneta-client.ts` makes: the accounts
   * listing and an account's transactions. The token goes as a bearer.
   */
  moneta: {
    origin: "https://api.moneta.cz",
    paths: new RegExp(
      `^/api/v4/vip/aisp/my/accounts(?:/${segment}/transactions)?(?:\\?[^#]*)?$`,
      "u"
    ),
    requestHeaders: ["accept", "authorization"],
  },
} as const satisfies Record<string, ProxiedServiceConfig>

export type ProxiedService = keyof typeof proxiedServices

export const proxiedServiceNames = Object.keys(
  proxiedServices
) as ReadonlyArray<keyof typeof proxiedServices>

export const isProxiedService = (value: string): value is ProxiedService =>
  Object.hasOwn(proxiedServices, value)

/** Carries the upstream path and query, so neither lands in the proxy URL. */
export const SERVICE_PROXY_PATH_HEADER = "x-proxy-path"

/**
 * Marks a response the proxy itself failed, not the service behind it, so a
 * client never reads it as the service's own answer (a refused token, say).
 */
export const SERVICE_PROXY_ERROR_HEADER = "x-service-proxy-error"

/**
 * Marks a response the proxy relayed from the service, set to
 * `SERVICE_PROXY_RELAYED`. Only a response carrying it is the service's
 * answer: one without it comes from somewhere in front of the proxy — the
 * hosting platform's firewall, deployment protection, rate limit or error
 * page — and a 401 from there is not the bank refusing the token.
 */
export const SERVICE_PROXY_RELAYED_HEADER = "x-service-proxy"

/** The value of `SERVICE_PROXY_RELAYED_HEADER` on a relayed answer. */
export const SERVICE_PROXY_RELAYED = "upstream"

/** The proxy endpoint of a service, under the app's `/api`. */
export const serviceProxyEndpointPath = (service: ProxiedService): string =>
  `/api/proxy/${service}`

const parseUrl = (url: string, base?: string): URL | null => {
  try {
    return new URL(url, base)
  } catch {
    return null
  }
}

/**
 * What a server could still turn into a step up the path after the URL has
 * been normalized: an escaped `.` or `\`, or `..` inside a segment, as in
 * `..%2F`. An escaped `/` alone stays, as a MONETA account id may carry one.
 */
const pathTraversal = /%(?:2e|5c)|\.\./iu

/**
 * The URL the proxy calls for a service and the path and query the browser
 * sent, or null unless it stays on the service's origin and is one of the
 * calls the service's client makes. An absolute or protocol-relative URL,
 * a backslash, a fragment, credentials and anything a server could decode
 * into `..` are refused; a plain `..` segment is resolved before the path is
 * checked.
 */
export const resolveServiceProxyUpstreamUrl = (
  service: ProxiedService,
  pathAndQuery: string
): URL | null => {
  const config: ProxiedServiceConfig = proxiedServices[service]
  if (
    !pathAndQuery.startsWith("/") ||
    pathAndQuery.startsWith("//") ||
    pathAndQuery.includes("\\") ||
    pathAndQuery.includes("#")
  ) {
    return null
  }

  const url = parseUrl(pathAndQuery, config.origin)
  if (url === null) return null
  if (url.origin !== config.origin) return null
  if (url.username !== "" || url.password !== "") return null
  if (pathTraversal.test(url.pathname)) return null
  if (!config.paths.test(`${url.pathname}${url.search}`)) return null

  return url
}

/** The service whose origin a URL is on, or null for any other URL. */
export const findProxiedServiceForUrl = (
  url: string | URL
): ProxiedService | null => {
  const parsed = typeof url === "string" ? parseUrl(url) : url
  if (parsed === null) return null

  return (
    proxiedServiceNames.find(
      (service) => proxiedServices[service].origin === parsed.origin
    ) ?? null
  )
}
