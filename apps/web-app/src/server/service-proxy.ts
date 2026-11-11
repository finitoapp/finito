import {
  type ProxiedService,
  proxiedServices,
  resolveServiceProxyUpstreamUrl,
  SERVICE_PROXY_ERROR_HEADER,
  SERVICE_PROXY_PATH_HEADER,
  SERVICE_PROXY_RELAYED,
  SERVICE_PROXY_RELAYED_HEADER,
} from "@payky/core/integrations/service-proxy/service-proxy-services"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { loadServerEnv, throwInvalidServerEnv } from "./server-env.js"

/**
 * Why the proxy answered a request itself instead of passing on the
 * service's answer, sent in `x-service-proxy-error`. None maps to `401` or
 * `403`: those are what a bank answers a refused token with, and a client
 * that missed the header must not stop syncing over the proxy's own refusal.
 */
export type ServiceProxyErrorReason =
  | "method-not-allowed"
  | "foreign-origin"
  | "path-not-allowed"
  | "upstream-redirected"
  | "upstream-unreachable"

const errorStatuses = {
  "method-not-allowed": 405,
  // Misdirected: the proxy serves its own frontend, not this page.
  "foreign-origin": 421,
  "path-not-allowed": 400,
  "upstream-redirected": 502,
  "upstream-unreachable": 502,
} as const satisfies Record<ServiceProxyErrorReason, number>

/** Origins with a scheme and host and nothing else, as `Origin` sends them. */
const OriginListSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== "")
  )
  .pipe(
    z.array(
      z
        .string()
        .refine(
          (origin) =>
            URL.canParse(origin) &&
            /^https?:$/u.test(new URL(origin).protocol) &&
            new URL(origin).origin === origin,
          "Not an origin."
        )
    )
  )

/**
 * The foreign origins the proxy answers besides its own, from
 * `PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS`; an unset or invalid value allows
 * none, so a typo closes the proxy to them rather than opening it.
 */
const loadAllowedOrigins = (
  runtimeEnv: Readonly<Record<string, string | undefined>>
): ReadonlyArray<string> =>
  loadServerEnv(() =>
    createEnv({
      server: {
        PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS: OriginListSchema.default([]),
      },
      runtimeEnv,
      emptyStringAsUndefined: true,
      onValidationError: throwInvalidServerEnv,
    })
  )?.PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS ?? []

type RequestOrigin =
  | { readonly type: "own" }
  | { readonly type: "allowed"; readonly origin: string }
  | { readonly type: "foreign" }

/**
 * Whose page sent the request. A browser sends no `Origin` with a GET to its
 * own origin, so a missing one is the app's own frontend — unless
 * `Sec-Fetch-Site` says another site's page sent it. The own origin is the
 * request's URL, never `x-forwarded-host`, as in `api/lnurlp/donate.ts`.
 */
const classifyOrigin = (
  request: Request,
  allowedOrigins: ReadonlyArray<string>
): RequestOrigin => {
  const origin = request.headers.get("origin")
  if (origin === null) {
    const fetchSite = request.headers.get("sec-fetch-site")
    return fetchSite === "cross-site" || fetchSite === "same-site"
      ? { type: "foreign" }
      : { type: "own" }
  }
  if (origin === new URL(request.url).origin) return { type: "own" }
  if (allowedOrigins.includes(origin)) return { type: "allowed", origin }
  return { type: "foreign" }
}

const corsHeaders = (requestOrigin: RequestOrigin): Record<string, string> =>
  requestOrigin.type === "allowed"
    ? {
        "access-control-allow-origin": requestOrigin.origin,
        // Without them a foreign page could not tell the proxy's failure, or
        // the platform's, from the service's answer.
        "access-control-expose-headers": `${SERVICE_PROXY_ERROR_HEADER}, ${SERVICE_PROXY_RELAYED_HEADER}`,
        vary: "origin",
      }
    : {}

const errorResponse = (
  reason: ServiceProxyErrorReason,
  requestOrigin: RequestOrigin
): Response =>
  Response.json(
    { error: reason },
    {
      status: errorStatuses[reason],
      headers: {
        ...corsHeaders(requestOrigin),
        "cache-control": "no-store",
        [SERVICE_PROXY_ERROR_HEADER]: reason,
        ...(reason === "method-not-allowed" ? { allow: "GET, OPTIONS" } : {}),
      },
    }
  )

/**
 * The proxy for a service that answers no CORS preflight
 * (`docs/decisions/service-proxy/0001`): a GET to the service's origin and one of
 * its client's paths, both taken from `proxiedServices`, the path and query
 * read from `x-proxy-path`. Only the service's own request headers go on, and
 * the answer streams back with its status and `content-type`, marked
 * `x-service-proxy: upstream` so the browser can tell it from an answer of
 * the platform in front of the proxy.
 *
 * It logs nothing: the path carries a Fio token and the answer an account's
 * history. Only the app's own frontend, and the origins
 * `PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS` lists, may call it.
 */
export const handleServiceProxyRequest = async (
  request: Request,
  {
    service,
    fetch = globalThis.fetch,
    env = process.env,
  }: {
    readonly service: ProxiedService
    readonly fetch?: typeof globalThis.fetch
    readonly env?: Readonly<Record<string, string | undefined>>
  }
): Promise<Response> => {
  const requestOrigin = classifyOrigin(request, loadAllowedOrigins(env))
  if (requestOrigin.type === "foreign") {
    return errorResponse("foreign-origin", requestOrigin)
  }

  if (request.method === "OPTIONS" && requestOrigin.type === "allowed") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(requestOrigin),
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": `accept, authorization, ${SERVICE_PROXY_PATH_HEADER}`,
        "cache-control": "no-store",
      },
    })
  }

  if (request.method !== "GET") {
    return errorResponse("method-not-allowed", requestOrigin)
  }

  const pathAndQuery = request.headers.get(SERVICE_PROXY_PATH_HEADER)
  const upstreamUrl =
    pathAndQuery === null
      ? null
      : resolveServiceProxyUpstreamUrl(service, pathAndQuery)
  if (upstreamUrl === null) {
    return errorResponse("path-not-allowed", requestOrigin)
  }

  const headers = new Headers()
  for (const name of proxiedServices[service].requestHeaders) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      // A redirect would leave the service's origin, the one place it may go.
      redirect: "manual",
      signal: request.signal,
    })
  } catch {
    return errorResponse("upstream-unreachable", requestOrigin)
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel().catch(() => undefined)
    return errorResponse("upstream-redirected", requestOrigin)
  }

  const contentType = upstream.headers.get("content-type")
  // Streamed as it arrives. `content-encoding` and `content-length` stay
  // behind: fetch has already decoded the body they describe.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...corsHeaders(requestOrigin),
      "cache-control": "no-store",
      ...(contentType === null ? {} : { "content-type": contentType }),
      [SERVICE_PROXY_RELAYED_HEADER]: SERVICE_PROXY_RELAYED,
    },
  })
}
