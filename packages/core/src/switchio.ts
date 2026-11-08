import { err, ok, type Result } from "@evolu/common"
import { z } from "zod"

import { defineError } from "./error.ts"
import { jsonCodec } from "./zod-utils.ts"

/**
 * What the native `payResult` callback resolves with. Also the `data` of a
 * Capacitor `appRestoredResult` event when Android killed this app while
 * SwitchioPay was in the foreground — `transactionId` echoes the request's,
 * so a restored result can be matched to its payment. The event's `data` is
 * untyped, hence a schema rather than a bare interface.
 */
export const SwitchioNativePayResultSchema = z.object({
  resultCode: z.number(),
  transactionResult: z.string().nullable().default(null),
  transactionId: z.string().nullable().default(null),
})
export type SwitchioNativePayResult = z.output<
  typeof SwitchioNativePayResultSchema
>

/**
 * Bundle result codes returned by the SwitchioPay activity, per ECR API
 * section 3.3.
 */
const switchioResultCode = {
  success: -1,
  failure: 0,
  initFailure: 1,
  terminalBusy: 2,
} as const

/**
 * The subset of the ECR v8 transaction result this app keeps. Every field is
 * documented as optional, so all of them are read leniently; unknown fields
 * are dropped by zod.
 */
const SwitchioTransactionResultSchema = z.object({
  transactionId: z.string().nullish(),
  responseCode: z.string().nullish(),
  responseMessage: z.string().nullish(),
  authCode: z.string().nullish(),
  sequenceNumber: z.string().nullish(),
  pan: z.string().nullish(),
  appLabel: z.string().nullish(),
  brand: z.string().nullish(),
  terminalIdAcquirer: z.string().nullish(),
  dateTimeTerminal: z.string().nullish(),
})
const SwitchioTransactionResultJson = jsonCodec(SwitchioTransactionResultSchema)

export const createSwitchioUnavailableError = defineError(
  "SwitchioUnavailable"
)<{
  readonly reason: "notNativeRuntime" | "notInstalled"
}>()
export type SwitchioUnavailableError = ReturnType<
  typeof createSwitchioUnavailableError
>

const createSwitchioPaymentFailedError = defineError("SwitchioPaymentFailed")<{
  readonly resultCode: number
  readonly responseCode: string | null
  readonly responseMessage: string | null
}>()
export type SwitchioPaymentFailedError = ReturnType<
  typeof createSwitchioPaymentFailedError
>

/**
 * The outcome of the terminal transaction is unknown: it reported success
 * but its payload could not be read, or the bridge call failed after the
 * intent may already have left (`resultCode` is then `null`). Kept separate
 * from {@link SwitchioPaymentFailedError} on purpose: the card may well have
 * been charged, so this must never be shown as "declined" — staff has to
 * verify the transaction in the SwitchioPay app.
 */
export const createSwitchioResultUnreadableError = defineError(
  "SwitchioResultUnreadable"
)<{
  readonly resultCode: number | null
  readonly rawResult: string | null
}>()
export type SwitchioResultUnreadableError = ReturnType<
  typeof createSwitchioResultUnreadableError
>

export type SwitchioPaymentError =
  | SwitchioUnavailableError
  | SwitchioPaymentFailedError
  | SwitchioResultUnreadableError

export interface SwitchioCardPaymentResult {
  readonly responseCode: string | null
  readonly authCode: string | null
  readonly sequenceNumber: string | null
  readonly maskedPan: string | null
  readonly cardLabel: string | null
  readonly terminalId: string | null
  readonly terminalDateTime: string | null
}

const optionalString = (value: string | null | undefined): string | null =>
  value === null || value === undefined || value === "" ? null : value

/**
 * Turns one intent result into a domain Result.
 *
 * Success requires the documented success result code *and* a
 * `responseCode` that is either the terminal's `"OK"` or absent — the field
 * is optional in the ECR result structure, so a terminal that omits it must
 * still be able to complete a payment, while an explicit non-`OK` code
 * always means the transaction did not go through.
 */
export const interpretSwitchioPaymentResult = ({
  resultCode,
  transactionResult,
}: {
  readonly resultCode: number
  readonly transactionResult: string | null
}): Result<SwitchioCardPaymentResult, SwitchioPaymentError> => {
  const parsed = ((): z.output<
    typeof SwitchioTransactionResultSchema
  > | null => {
    if (transactionResult === null || transactionResult === "") return null

    const result = z.safeDecode(
      SwitchioTransactionResultJson,
      transactionResult
    )
    return result.success ? result.data : null
  })()

  // Android answers 0 (RESULT_CANCELED) with no data when the terminal app
  // crashes, is killed, or, with the reorder-to-front flag, was already
  // running and takes the card after the result has come back. Without the
  // terminal's own words that is not a decline: the card may be charged.
  if (resultCode === switchioResultCode.failure && parsed === null) {
    return err(
      createSwitchioResultUnreadableError({
        resultCode,
        rawResult: transactionResult,
      })
    )
  }

  if (resultCode !== switchioResultCode.success) {
    return err(
      createSwitchioPaymentFailedError({
        resultCode,
        responseCode: optionalString(parsed?.responseCode),
        responseMessage: optionalString(parsed?.responseMessage),
      })
    )
  }

  if (parsed === null) {
    return err(
      createSwitchioResultUnreadableError({
        resultCode,
        rawResult: transactionResult,
      })
    )
  }

  const responseCode = optionalString(parsed.responseCode)
  if (responseCode !== null && responseCode !== "OK") {
    return err(
      createSwitchioPaymentFailedError({
        resultCode,
        responseCode,
        responseMessage: optionalString(parsed.responseMessage),
      })
    )
  }

  return ok({
    responseCode,
    authCode: optionalString(parsed.authCode),
    sequenceNumber: optionalString(parsed.sequenceNumber),
    maskedPan: optionalString(parsed.pan),
    cardLabel: optionalString(parsed.appLabel) ?? optionalString(parsed.brand),
    terminalId: optionalString(parsed.terminalIdAcquirer),
    terminalDateTime: optionalString(parsed.dateTimeTerminal),
  })
}

export interface SwitchioTerminalDep {
  readonly switchioTerminal: {
    readonly pay: (request: {
      readonly transactionId: string
      readonly amount: number
      readonly tipAmount: number
      readonly currencyCode: number
      readonly invoiceNumber?: string
    }) => Promise<Result<SwitchioCardPaymentResult, SwitchioPaymentError>>
  }
}

/**
 * What the native `close` callback resolves with, and what the closure's own
 * result store keeps when Android killed this app while SwitchioPay was
 * closing the batch. Unlike a payment it has no `transactionId`: a closure
 * request carries nothing to echo.
 */
export const SwitchioNativeClosureResultSchema = z.object({
  resultCode: z.number(),
  transactionResult: z.string().nullable().default(null),
})
export type SwitchioNativeClosureResult = z.output<
  typeof SwitchioNativeClosureResultSchema
>

const BatchCountSchema = z.number().int().nonnegative()
const BatchAmountSchema = z.number().int()

/**
 * The `CLOSE_BATCH` result of ECR v8 (section 4.1, appendix BatchTotals).
 * Read as leniently as a payment result; only `batchTotals` is required for
 * a closure to be kept, since without it there is nothing to record.
 */
const SwitchioClosureResultSchema = z.object({
  transactionType: z.string().nullish(),
  responseCode: z.string().nullish(),
  responseMessage: z.string().nullish(),
  dateTimeTerminal: z.string().nullish(),
  batchTotals: z
    .object({
      shiftNumber: BatchCountSchema,
      batchNumber: BatchCountSchema,
      debitsCount: BatchCountSchema,
      debitsAmount: BatchAmountSchema,
      creditsCount: BatchCountSchema,
      creditsAmount: BatchAmountSchema,
      adjsCount: BatchCountSchema,
      adjsAmount: BatchAmountSchema,
    })
    .nullish()
    .catch(null),
})
const SwitchioClosureResultJson = jsonCodec(SwitchioClosureResultSchema)

const createSwitchioClosureFailedError = defineError("SwitchioClosureFailed")<{
  readonly resultCode: number
  readonly responseCode: string | null
  readonly responseMessage: string | null
}>()
export type SwitchioClosureFailedError = ReturnType<
  typeof createSwitchioClosureFailedError
>

/**
 * The closure's failures. {@link SwitchioResultUnreadableError} means the
 * batch may well have been closed: staff has to check SwitchioPay, so it is
 * never reported as a failed closure.
 */
export type SwitchioClosureError =
  | SwitchioUnavailableError
  | SwitchioClosureFailedError
  | SwitchioResultUnreadableError

/**
 * A closed batch as the terminal reported it. `debitsAmount` is what the
 * cards were charged, tips included, in minor units of the terminal's
 * currency, which the result does not name.
 */
export interface SwitchioClosure {
  readonly batchNumber: number
  readonly shiftNumber: number
  readonly debitsCount: number
  readonly debitsAmount: number
  readonly creditsCount: number
  readonly creditsAmount: number
  readonly adjsCount: number
  readonly adjsAmount: number
  readonly terminalDateTime: string | null
  readonly responseMessage: string | null
}

/**
 * Turns one closure intent result into a domain Result, by the same rules as
 * {@link interpretSwitchioPaymentResult}: success needs the success result
 * code and a `responseCode` that is `"OK"` or absent, a cancelled result with
 * no data is an unknown outcome rather than a failure, and a success whose
 * totals cannot be read is unknown too — the batch may be closed, but there
 * is nothing to keep.
 */
export const interpretSwitchioClosureResult = ({
  resultCode,
  transactionResult,
}: SwitchioNativeClosureResult): Result<
  SwitchioClosure,
  SwitchioClosureError
> => {
  const parsed = ((): z.output<typeof SwitchioClosureResultSchema> | null => {
    if (transactionResult === null || transactionResult === "") return null
    const result = z.safeDecode(SwitchioClosureResultJson, transactionResult)
    return result.success ? result.data : null
  })()

  const unreadable = err(
    createSwitchioResultUnreadableError({
      resultCode,
      rawResult: transactionResult,
    })
  )

  if (resultCode === switchioResultCode.failure && parsed === null) {
    return unreadable
  }

  if (resultCode !== switchioResultCode.success) {
    return err(
      createSwitchioClosureFailedError({
        resultCode,
        responseCode: optionalString(parsed?.responseCode),
        responseMessage: optionalString(parsed?.responseMessage),
      })
    )
  }

  if (parsed === null) return unreadable

  const responseCode = optionalString(parsed.responseCode)
  if (responseCode !== null && responseCode !== "OK") {
    return err(
      createSwitchioClosureFailedError({
        resultCode,
        responseCode,
        responseMessage: optionalString(parsed.responseMessage),
      })
    )
  }

  const totals = parsed.batchTotals
  if (totals === null || totals === undefined) return unreadable

  return ok({
    ...totals,
    terminalDateTime: optionalString(parsed.dateTimeTerminal),
    responseMessage: optionalString(parsed.responseMessage),
  })
}

/**
 * Closes the batch of the SwitchioPay terminal on this phone. Kept apart from
 * {@link SwitchioTerminalDep} so that an app which only takes payments (web's
 * Capacitor bridge) need not implement it.
 */
export interface SwitchioClosureDep {
  readonly switchioClosure: {
    readonly close: () => Promise<Result<SwitchioClosure, SwitchioClosureError>>
  }
}
