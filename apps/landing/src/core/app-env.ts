import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const appEnv = createEnv({
  clientPrefix: "VITE_",
  // Which app the landing presents (landing/0013), inlined at build time
  // (`envPrefix` in vite.config.ts) so the prerender and the hydration agree.
  shared: {
    PAYKY_LANDING_BRAND: z.enum(["payky", "finito"]).default("payky"),
  },
  // The app's origin, its API's included; unset, Payky's landing calls the
  // origin it is served from and Finito's app.finito.fit.
  client: { VITE_PAYKY_API_BASE_URL: z.url().optional() },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
})
