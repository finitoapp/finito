import type { BrandId } from "@payky/app-shared/brand"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { loadServerEnv, throwInvalidServerEnv } from "./server-env.js"

/**
 * The app names the API writes into what it sends out (brand/0001). The
 * handlers cannot import `@payky/app-shared/brand`, which ships as TypeScript
 * that Node does not run, so the names are repeated here and
 * `server-brand.test.ts` holds them to the brands.
 */
export const serverBrandNames = {
  payky: "Payky",
  finito: "Finito",
} as const satisfies Record<BrandId, string>

const ServerBrandSchema = z
  .enum(["payky", "finito"])
  .default("payky") satisfies z.ZodType<BrandId>

/**
 * The name of the app this deployment serves, from `PAYKY_BRAND` (Payky when
 * unset); `null` when it names no brand, which answers that request as not
 * configured, as `loadServerEnv` does.
 */
export const loadServerBrandName = (): string | null => {
  const env = loadServerEnv(() =>
    createEnv({
      server: { PAYKY_BRAND: ServerBrandSchema },
      runtimeEnv: process.env,
      emptyStringAsUndefined: true,
      onValidationError: throwInvalidServerEnv,
    })
  )
  return env === null ? null : serverBrandNames[env.PAYKY_BRAND]
}
