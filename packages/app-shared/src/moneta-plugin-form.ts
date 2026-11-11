import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { MonetaConnectError } from "@payky/core/modules/moneta-plugin/moneta-plugin-actions"
import { minMonetaPluginCheckIntervalSeconds } from "@payky/core/modules/moneta-plugin/moneta-plugin-utils"
import {
  type NonEmptyString,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@payky/core/modules/shared/schema"
import { z } from "zod"

/**
 * The MONETA token is a secret: this validates what was typed, and holds
 * nothing of the token beyond the call; `maskMonetaToken` masks what is
 * shown afterwards.
 */
export const parseMonetaToken = (
  raw: string
):
  | { readonly ok: true; readonly token: NonEmptyString }
  | { readonly ok: false; readonly errorKey: TranslationKey } => {
  const result = NonEmptyStringSchema.safeParse(raw.replaceAll(/\s/gu, ""))
  return result.success
    ? { ok: true, token: result.data }
    : { ok: false, errorKey: "settings.monetaPlugin.token.required" }
}

/** What a failed connect tells the merchant. */
export const monetaConnectErrorKeys = {
  MonetaUnauthorizedError: "settings.monetaPlugin.connect.error.unauthorized",
  MonetaAccountNotVisible:
    "settings.monetaPlugin.connect.error.accountNotVisible",
  MonetaRateLimitError: "settings.monetaPlugin.connect.error.rateLimited",
  MonetaHttpError: "settings.monetaPlugin.connect.error.unreachable",
  FetchError: "settings.monetaPlugin.connect.error.unreachable",
  MonetaApiError: "settings.monetaPlugin.connect.error.unexpected",
} satisfies Record<MonetaConnectError["type"], TranslationKey>

/** The background interval, at least a minute (moneta/0010). */
export const monetaCheckIntervalCodec = z.codec(
  z.string(),
  PositiveIntegerSchema.min(minMonetaPluginCheckIntervalSeconds),
  {
    decode: (value) =>
      /^\d+$/u.test(value.trim()) ? Number(value.trim()) : Number.NaN,
    encode: String,
  }
)
