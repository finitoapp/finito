import { err, ok, type Task } from "@evolu/common"
import {
  type DateDep,
  type FetchDep,
  type FetchError,
  fetchAndValidateJson,
} from "@payky/core/deps"
import { defineError } from "@payky/core/error"
import {
  type EetCertificateError,
  type EetCertificateFile,
  type EetNativeCrypto,
  readEetCertificateFile,
} from "@payky/core/integrations/eet/eet-certificate"
import { EetBase64Schema } from "@payky/core/modules/eet/eet-types"
import { eetBase64ToBytes } from "@payky/core/modules/eet/eet-utils"
import { z } from "zod"

const PlaygroundCertificatesResponseSchema = z.object({
  password: z.string().min(1),
  certificates: z
    .array(z.object({ fileName: z.string(), p12Base64: EetBase64Schema }))
    .min(1),
})

const createPlaygroundCertificatesHttpError = defineError(
  "PlaygroundCertificatesHttpError"
)<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
}>()
export type PlaygroundCertificatesHttpError = ReturnType<
  typeof createPlaygroundCertificatesHttpError
>

const createPlaygroundCertificatesResponseError = defineError(
  "PlaygroundCertificatesResponseError"
)<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
  readonly cause?: unknown
}>()
export type PlaygroundCertificatesResponseError = ReturnType<
  typeof createPlaygroundCertificatesResponseError
>

const createPlaygroundCertificateUnreadableError = defineError(
  "PlaygroundCertificateUnreadableError"
)<{ readonly reason: EetCertificateError["type"] }>()
export type PlaygroundCertificateUnreadableError = ReturnType<
  typeof createPlaygroundCertificateUnreadableError
>

export type PlaygroundCertificatesError =
  | PlaygroundCertificatesHttpError
  | PlaygroundCertificatesResponseError
  | PlaygroundCertificateUnreadableError
  | FetchError

/** `url` is this app's own `/api/eet/playground-certificates`, absolute on native. */
export const fetchPlaygroundCertificates =
  (
    url: string,
    /** The native app's crypto; see `EetNativeCrypto`. */
    native?: EetNativeCrypto
  ): Task<
    ReadonlyArray<EetCertificateFile>,
    PlaygroundCertificatesError,
    FetchDep & DateDep
  > =>
  async (run) => {
    const response = await run(
      fetchAndValidateJson({
        url,
        schema: PlaygroundCertificatesResponseSchema,
        // Both errors leave the body out on purpose. A successful body is
        // the test certificates and their password, so one that failed
        // validation may still carry them, and an error's payload can reach
        // the debug console or Sentry. The HTTP-error body is only this
        // app's own error JSON, left out the same way so neither path ever
        // has to be checked again.
        onHttpError: ({ status }) =>
          createPlaygroundCertificatesHttpError({
            message: `Official EET test certificates request failed: ${status}`,
            status,
            responseBody: "",
          }),
        onResponseError: ({ status, cause }) =>
          createPlaygroundCertificatesResponseError({
            message: "Invalid official EET test certificates response.",
            status,
            responseBody: "",
            cause,
          }),
      })
    )
    if (!response.ok) return response

    const { password, certificates } = response.value
    const now = run.deps.date.now()
    const files: EetCertificateFile[] = []
    for (const { p12Base64 } of certificates) {
      const file = await readEetCertificateFile({
        file: eetBase64ToBytes(p12Base64),
        password,
        now,
        native,
      })
      if (!file.ok) {
        return err(
          createPlaygroundCertificateUnreadableError({
            reason: file.error.type,
          })
        )
      }
      files.push(file.value)
    }

    return ok(files)
  }
