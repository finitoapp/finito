/**
 * Points the build at the mock server (mock-server.ts) at `host:port`, as the
 * app sees it: 127.0.0.1 on web, the emulator's 10.0.2.2 alias of the host on
 * Android. Expo inlines EXPO_PUBLIC_* at build time, so the host is baked in.
 * The e2e runner (run.ts) and the documentation screenshots
 * (scripts/generate-doc-screenshots.ts) build this way.
 */
export function pointAtMocks(host: string, port: number): void {
  const base = `http://${host}:${port}`
  process.env.EXPO_PUBLIC_PAYKY_API_BASE_URL = base
  process.env.EXPO_PUBLIC_PAYKY_YADIO_URL = base
  process.env.EXPO_PUBLIC_PAYKY_QERKO_BASE_URL = `${base}/qerko`
  process.env.EXPO_PUBLIC_PAYKY_EET_PRODUCTION_URL = `${base}/eet/services/EETServiceSOAP/v4`
  process.env.EXPO_PUBLIC_PAYKY_NOSTR_RELAYS = `ws://${host}:${port}/nostr`
  process.env.EXPO_PUBLIC_PAYKY_EET_PLAYGROUND_URL = `${base}/eet-playground/services/EETServiceSOAP/v4`
}
