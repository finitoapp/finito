import { SelfPayRelaysSchema } from "@payky/core/integrations/nostr/nostr-default-relays"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { appBrand } from "./app-brand.ts"

// Mirrors the web app's VITE_* client variables (apps/web-app/src/core/app-env.ts)
// that native needs. Expo inlines only static `process.env.EXPO_PUBLIC_X`
// references, so each one is listed explicitly in `runtimeEnv`.
export const nativeEnv = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    // The brand's production API: the Android app has no origin of its own,
    // and its web export is served beside it.
    EXPO_PUBLIC_PAYKY_API_BASE_URL: z.url().default(appBrand.apiBaseUrl),
    EXPO_PUBLIC_PAYKY_EET_PRODUCTION_URL: z.url().optional(),
    // Set by the e2e builds to the mock server; default is Yadio itself.
    EXPO_PUBLIC_PAYKY_YADIO_URL: z.url().optional(),
    // The `Pos-Id` header of every Qerko POS API call (see web's
    // `VITE_PAYKY_QERKO_POS_ID`).
    EXPO_PUBLIC_PAYKY_QERKO_POS_ID: z.string().default("payky"),
    // Set by the e2e builds to the mock server; unset, the environment picked
    // when pairing decides the host.
    EXPO_PUBLIC_PAYKY_QERKO_BASE_URL: z.url().optional(),
    // Set only by the e2e builds: the mock server stands in for EET's playground.
    EXPO_PUBLIC_PAYKY_EET_PLAYGROUND_URL: z.url().optional(),
    EXPO_PUBLIC_PAYKY_DONATE_LUD16_ADDRESS: z
      .string()
      .default(appBrand.donateLightningAddress),
    EXPO_PUBLIC_PAYKY_NOSTR_RELAYS: z
      .string()
      .transform((value) => value.split(",").map((url) => url.trim()))
      .pipe(z.array(z.url({ protocol: /^wss?$/u })).min(1))
      .default([
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://relay.0xchat.com",
        "wss://nostr.linky.fit",
      ]),
    EXPO_PUBLIC_LINKY_RELAYS_URL: z
      .url()
      .default("https://linky.fit/recommended-relays"),
    EXPO_PUBLIC_LINKY_EVOLU_RELAYS: z
      .string()
      .transform((value) => value.split(",").map((url) => url.trim()))
      .pipe(z.array(z.url({ protocol: /^wss$/u })).min(1))
      .default(["wss://evolu.eu.freedomrelay.dev", "wss://evolu.linky.fit"]),
    EXPO_PUBLIC_PAYKY_SELF_PAY_ORIGIN: z.url().default(appBrand.selfPayOrigin),
    EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS: SelfPayRelaysSchema,
    EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
    // Set only by the e2e builds (e2e/scripts); turns on the e2e bridge route.
    EXPO_PUBLIC_PAYKY_E2E: z.stringbool().default(false),
  },
  runtimeEnv: {
    EXPO_PUBLIC_PAYKY_API_BASE_URL: process.env.EXPO_PUBLIC_PAYKY_API_BASE_URL,
    EXPO_PUBLIC_PAYKY_EET_PRODUCTION_URL:
      process.env.EXPO_PUBLIC_PAYKY_EET_PRODUCTION_URL,
    EXPO_PUBLIC_PAYKY_YADIO_URL: process.env.EXPO_PUBLIC_PAYKY_YADIO_URL,
    EXPO_PUBLIC_PAYKY_QERKO_POS_ID: process.env.EXPO_PUBLIC_PAYKY_QERKO_POS_ID,
    EXPO_PUBLIC_PAYKY_QERKO_BASE_URL:
      process.env.EXPO_PUBLIC_PAYKY_QERKO_BASE_URL,
    EXPO_PUBLIC_PAYKY_EET_PLAYGROUND_URL:
      process.env.EXPO_PUBLIC_PAYKY_EET_PLAYGROUND_URL,
    EXPO_PUBLIC_PAYKY_DONATE_LUD16_ADDRESS:
      process.env.EXPO_PUBLIC_PAYKY_DONATE_LUD16_ADDRESS,
    EXPO_PUBLIC_PAYKY_NOSTR_RELAYS: process.env.EXPO_PUBLIC_PAYKY_NOSTR_RELAYS,
    EXPO_PUBLIC_LINKY_RELAYS_URL: process.env.EXPO_PUBLIC_LINKY_RELAYS_URL,
    EXPO_PUBLIC_LINKY_EVOLU_RELAYS: process.env.EXPO_PUBLIC_LINKY_EVOLU_RELAYS,
    EXPO_PUBLIC_PAYKY_SELF_PAY_ORIGIN:
      process.env.EXPO_PUBLIC_PAYKY_SELF_PAY_ORIGIN,
    EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS:
      process.env.EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_PAYKY_E2E: process.env.EXPO_PUBLIC_PAYKY_E2E,
  },
  emptyStringAsUndefined: true,
})

/** An absolute URL of `path` on the app's API. */
export const apiUrl = (path: string): string =>
  new URL(path, nativeEnv.EXPO_PUBLIC_PAYKY_API_BASE_URL).toString()
