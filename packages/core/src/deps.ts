import {
  AbortError,
  type AppOwner,
  err,
  ok,
  type Result,
  type Task,
  tryAsync,
} from "@evolu/common"
import type { JsonValue } from "type-fest"
import { z } from "zod"
import { defineError } from "./error.ts"
import type { DeviceId } from "./modules/device/device-types.ts"
import type { MasterKey } from "./modules/shared/key-derivation.ts"
import type { WssUrl } from "./modules/shared/schema.ts"
import { jsonCodec } from "./zod-utils.ts"

export interface FetchDep {
  readonly fetch: typeof globalThis.fetch
}

const createFetchError = defineError("FetchError")<{
  readonly error: unknown
}>()
export type FetchError = ReturnType<typeof createFetchError>

const appFetchAsText =
  (
    url: string | URL,
    init?: RequestInit
  ): Task<
    Pick<Response, "ok" | "status"> & { text: string },
    FetchError,
    FetchDep
  > =>
  ({ deps, signal }) =>
    tryAsync(
      async () => {
        const response = await deps.fetch(url, { ...init, signal })

        return {
          text: await response.text(),
          ok: response.ok,
          status: response.status,
        }
      },
      (error): FetchError => {
        if (AbortError.is(error)) throw error
        return createFetchError({ error })
      }
    )

const createFetchJsonError = defineError("FetchJsonError")<{
  readonly message: string
  readonly error: unknown
}>()
export type FetchJsonError = ReturnType<typeof createFetchJsonError>

// `z.unknown()`, not `z.json()`: what `JSON.parse` returns is JSON already,
// and walking a large response body a second time buys nothing.
const JsonBody = jsonCodec(z.unknown())

const parseJsonBody = (text: string): Result<JsonValue, FetchJsonError> => {
  const parsed = z.safeDecode(JsonBody, text)
  return parsed.success
    ? ok(parsed.data as JsonValue)
    : err(
        createFetchJsonError({
          message: "Response body is not valid JSON.",
          error: parsed.error,
        })
      )
}

/**
 * Fetches through {@link appFetchAsText} and additionally parses the body as
 * JSON.
 *
 * HTTP-level handling stays with the caller: `ok`, `status`, and the raw
 * `text` describe the HTTP response, while `json` carries the parsed body as
 * a Result. A non-JSON body is represented as a {@link FetchJsonError} on the
 * `json` Result so each client can turn it into its own typed parse error
 * (carrying `status` and `responseBody`) after it has handled HTTP-level
 * failures — which {@link validateJsonResponse} does for every client.
 */
export const appFetchAsJson =
  (
    url: string | URL,
    init?: RequestInit
  ): Task<
    Pick<Response, "ok" | "status"> & {
      readonly text: string
      readonly json: Result<JsonValue, FetchJsonError>
    },
    FetchError,
    FetchDep
  > =>
  async (run) => {
    const response = await run(appFetchAsText(url, init))
    if (!response.ok) return response

    return ok({
      ...response.value,
      json: parseJsonBody(response.value.text),
    })
  }

/**
 * Runs the shared HTTP-ok → JSON-parsed → schema-valid checks against an
 * already-fetched {@link appFetchAsJson} response, letting each caller
 * supply its own error types via `onHttpError`/`onResponseError`.
 */
export const validateJsonResponse = <
  TSchema extends z.ZodType,
  EHttp,
  EResponse,
>(
  response: Pick<Response, "ok" | "status"> & {
    readonly text: string
    readonly json: Result<JsonValue, FetchJsonError>
  },
  {
    schema,
    onHttpError,
    onResponseError,
  }: {
    readonly schema: TSchema
    readonly onHttpError: (info: {
      readonly status: number
      readonly responseBody: string
    }) => EHttp
    readonly onResponseError: (info: {
      readonly status: number
      readonly responseBody: string
      readonly cause: unknown
    }) => EResponse
  }
): Result<z.output<TSchema>, EHttp | EResponse> => {
  if (!response.ok) {
    return err(
      onHttpError({ status: response.status, responseBody: response.text })
    )
  }

  if (!response.json.ok) {
    return err(
      onResponseError({
        status: response.status,
        responseBody: response.text,
        cause: response.json.error,
      })
    )
  }

  const parsed = schema.safeParse(response.json.value)
  if (!parsed.success) {
    return err(
      onResponseError({
        status: response.status,
        responseBody: response.text,
        cause: parsed.error,
      })
    )
  }

  return ok(parsed.data)
}

/**
 * Fetches JSON and validates it against `schema` in one step, combining
 * {@link appFetchAsJson} with {@link validateJsonResponse}.
 */
export const fetchAndValidateJson =
  <TSchema extends z.ZodType, EHttp, EResponse>({
    url,
    init,
    schema,
    onHttpError,
    onResponseError,
  }: {
    readonly url: string | URL
    readonly init?: RequestInit
    readonly schema: TSchema
    readonly onHttpError: (info: {
      readonly status: number
      readonly responseBody: string
    }) => EHttp
    readonly onResponseError: (info: {
      readonly status: number
      readonly responseBody: string
      readonly cause: unknown
    }) => EResponse
  }): Task<z.output<TSchema>, EHttp | EResponse | FetchError, FetchDep> =>
  async (run) => {
    const responseResult = await run(appFetchAsJson(url, init))
    if (!responseResult.ok) return responseResult

    return validateJsonResponse(responseResult.value, {
      schema,
      onHttpError,
      onResponseError,
    })
  }

/**
 * Random UUIDs, for ids another service demands in that shape (Qerko's
 * transaction ids). A dep rather than `crypto.randomUUID()` because the
 * native runtime has its own source and tests want a fixed one.
 */
export type UuidDep = { readonly uuid: { readonly create: () => string } }

export type EvoluOwnerDep = { readonly evoluOwner: AppOwner }

export type MasterKeyDep = { readonly masterKey: MasterKey }

export interface TableSelfPayRootDep {
  readonly tableSelfPayRoot: Uint8Array
}

export interface SelfPayDefaultRelaysDep {
  readonly selfPayDefaultRelays: ReadonlyArray<WssUrl>
}

export type DeviceIdDep = { readonly deviceId: DeviceId }

/** The browser's `localStorage`, for the one migration that still reads it. */
export type LocalStorageDep = {
  readonly localStorage: Pick<Storage, "getItem" | "removeItem">
}

export type ConnectivityDep = {
  readonly connectivity: {
    readonly onOnline: (listener: () => void) => () => void
  }
}

export type DateDep = {
  readonly date: {
    readonly now: () => Date
  }
}

export const createDateDep = () => ({
  date: {
    now: () => new Date(),
  },
})
