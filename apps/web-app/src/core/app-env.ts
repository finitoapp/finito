import { Capacitor } from "@capacitor/core"
import { SelfPayRelaysSchema } from "@payky/core/integrations/nostr/nostr-default-relays"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { appBrand } from "./app-brand.ts"

export const appEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    // Origin of the /api serverless functions, read through `apiUrl`. Unset
    // means the page's own origin, so every deployment calls its own /api.
    VITE_PAYKY_API_BASE_URL: z.url().optional(),
    VITE_PAYKY_EET_PRODUCTION_URL: z.url().optional(),
    // The `Pos-Id` header of every Qerko POS API call. The sandbox accepts any
    // value; the environment (production or sandbox) is chosen per account
    // when pairing, not here.
    VITE_PAYKY_QERKO_POS_ID: z.string().default("payky"),
    // Where the donations page sends sats.
    VITE_PAYKY_DONATE_LUD16_ADDRESS: z
      .string()
      .default(appBrand.donateLightningAddress),
    // Where the account's Nostr profile is read from and published to.
    // Linky's defaults, so both apps see the same profile.
    VITE_PAYKY_NOSTR_RELAYS: z
      .string()
      .transform((value) => value.split(",").map((url) => url.trim()))
      .pipe(z.array(z.url({ protocol: /^wss?$/u })).min(1))
      .default([
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://relay.0xchat.com",
        "wss://nostr.linky.fit",
      ]),
    // Where Linky publishes the Evolu relays its Cashu wallet syncs through;
    // Payky syncs the shared wallet over the same ones (cashu.md §2).
    VITE_LINKY_RELAYS_URL: z
      .url()
      .default("https://linky.fit/recommended-relays"),
    // Linky's bundled fallback, used until the list above has been fetched.
    VITE_LINKY_EVOLU_RELAYS: z
      .string()
      .transform((value) => value.split(",").map((url) => url.trim()))
      .pipe(z.array(z.url({ protocol: /^wss$/u })).min(1))
      .default(["wss://evolu.eu.freedomrelay.dev", "wss://evolu.linky.fit"]),
    // Unset leaves error reporting unavailable, whatever the device opted.
    VITE_SENTRY_DSN: z.string().optional(),
    VITE_PAYKY_SELF_PAY_ORIGIN: z.url().default(appBrand.selfPayOrigin),
    VITE_PAYKY_SELF_PAY_RELAYS: SelfPayRelaysSchema,
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
})

/**
 * An absolute URL of `path` on this app's own API. The web calls the
 * deployment it was served from; the native app, whose origin is
 * https://localhost with no /api of its own, and code running without a page
 * (Vitest, the landing prerender) call the brand's production API. `VITE_PAYKY_API_BASE_URL`
 * overrides both, which is how `bun run dev`, served without /api, reaches one.
 */
export const apiUrl = (path: string): string =>
  new URL(
    path,
    appEnv.VITE_PAYKY_API_BASE_URL ??
      (Capacitor.isNativePlatform() || typeof window === "undefined"
        ? appBrand.apiBaseUrl
        : window.location.origin)
  ).toString()
