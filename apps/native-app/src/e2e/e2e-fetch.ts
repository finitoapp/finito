import { nativeEnv } from "../core/native-env.ts"

/**
 * The https hosts the app reaches that e2e answers from the mock server:
 * LNURL is https-only and takes its host from a Lightning address (the
 * donation's, and the merchant's own in settings), so no env
 * var can point it at the plain-http mock, and the Open Facts client has its
 * hosts built in. Web's specs get this from `page.route`.
 */
const mockedHosts = [
  "finito.fit",
  "donate.e2e.test",
  "wallet.e2e.test",
  "world.openfoodfacts.org",
  "world.openbeautyfacts.org",
]

/** `input` itself, or its path on the mock server's `/__host/<host>` for a mocked host. */
export const e2eFetchInput = (input: RequestInfo | URL): RequestInfo | URL => {
  if (!nativeEnv.EXPO_PUBLIC_PAYKY_E2E) return input
  const raw =
    typeof input === "string" || input instanceof URL ? input : input.url
  const url = new URL(raw)
  if (!mockedHosts.includes(url.hostname)) return input
  return new URL(
    `/__host/${url.hostname}${url.pathname}${url.search}`,
    nativeEnv.EXPO_PUBLIC_PAYKY_API_BASE_URL
  ).toString()
}
