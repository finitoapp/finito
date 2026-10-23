import { nativeEnv } from "../core/native-env.ts"

const selfPayRelayHosts = new Set(
  nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS.map((url) => new URL(url).host)
)

const mockRelayUrl = new URL(
  "/nostr",
  nativeEnv.EXPO_PUBLIC_PAYKY_API_BASE_URL.replace(/^http/u, "ws")
).toString()

const e2eRelayUrl = (url: string | URL): string | URL =>
  selfPayRelayHosts.has(new URL(url).host) ? mockRelayUrl : url

export function routeE2eSelfPayRelays(): void {
  const AppWebSocket = globalThis.WebSocket
  globalThis.WebSocket = class extends AppWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(e2eRelayUrl(url), protocols)
    }
  }
}
