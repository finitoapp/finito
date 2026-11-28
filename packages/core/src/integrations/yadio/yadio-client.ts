import { ok, type Task } from "@evolu/common"
import { z } from "zod"
import {
  type FetchDep,
  type FetchError,
  fetchAndValidateJson,
} from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { FiatCurrency } from "../../modules/shared/schema.ts"

export interface ExchangeRateQuote {
  readonly exchangeRate: number
  readonly fetchedAt: number
}

const YADIO_BASE_URL = "https://api.yadio.io"

/**
 * The rate is the first step of a Lightning invoice, with staff and the
 * customer watching a spinner. Yadio answers within a second; a connection
 * that does not (Wi-Fi handed over to mobile data) fails here, offering a
 * retry, instead of after the app-wide minute.
 */
export const YADIO_FETCH_TIMEOUT_MS = 10_000

export interface YadioApiOptions {
  readonly baseUrl?: string
}

export interface YadioApiDep {
  readonly yadioApi: {
    readonly baseUrl: string
  }
}

export const createYadioApiDep = ({
  baseUrl = YADIO_BASE_URL,
}: YadioApiOptions = {}): YadioApiDep => ({
  yadioApi: {
    baseUrl,
  },
})

const YadioExchangeRateResponseSchema = z.object({
  BTC: z.number().positive(),
  timestamp: z.number().int().nonnegative(),
})

const createYadioHttpError = defineError("YadioHttpError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
}>()
export type YadioHttpError = ReturnType<typeof createYadioHttpError>

const createYadioApiError = defineError("YadioApiError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
  readonly cause?: unknown
}>()
export type YadioApiError = ReturnType<typeof createYadioApiError>

export const fetchYadioBtcExchangeRate =
  (
    currency: FiatCurrency
  ): Task<
    ExchangeRateQuote,
    YadioHttpError | YadioApiError | FetchError,
    YadioApiDep & FetchDep
  > =>
  async (run) => {
    const result = await run(
      fetchAndValidateJson({
        url: new URL(`/exrates/${currency}`, run.deps.yadioApi.baseUrl),
        timeoutMs: YADIO_FETCH_TIMEOUT_MS,
        schema: YadioExchangeRateResponseSchema,
        onHttpError: ({ status, responseBody }) =>
          createYadioHttpError({
            message: `Yadio exchange rate request failed: ${status}`,
            status,
            responseBody,
          }),
        onResponseError: ({ status, responseBody, cause }) =>
          createYadioApiError({
            message: "Invalid Yadio exchange rate response.",
            status,
            responseBody,
            cause,
          }),
      })
    )
    if (!result.ok) return result

    return ok({
      exchangeRate: result.value.BTC,
      fetchedAt: result.value.timestamp,
    })
  }
