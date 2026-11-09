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
  /** Whether the transaction is a reversal (ECR result structure). */
  reversal: z.boolean().nullish().catch(null),
  /** Whether the transaction was reversed since (ECR result structure). */
  isReversed: z.boolean().nullish().catch(null),
})
const SwitchioTransactionResultJson = jsonCodec(SwitchioTransactionResultSchema)

/**
 * The terminal was never reached. `demo`: a demo account calls no outside
 * service (demo-data/0001), so it never launches the real SwitchioPay.
 */
export const createSwitchioUnavailableError = defineError(
  "SwitchioUnavailable"
)<{
  readonly reason: "notNativeRuntime" | "notInstalled" | "demo"
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
  /**
   * What a referral refund names the payment by (ECR 5.17, SwitchioPay
   * 3.1.2 and later), always as the terminal's digits; `null` when the
   * terminal sent none, and such a payment cannot be refunded to the card.
   */
  readonly refundId: string | null
}

/**
 * Takes `refundId` from the raw result text rather than from the parsed
 * object. The ECR documents it as a `long` and a referral refund wants it
 * 18 digits long, past what a JavaScript number holds exactly, so
 * `JSON.parse` would round a numeric one before any schema saw it. A quoted
 * one is taken as it is; anything but digits is ignored.
 */
const readRawRefundId = (transactionResult: string | null): string | null => {
  if (transactionResult === null) return null
  const match = /"refundId"\s*:\s*(?:"(\d+)"|(\d+))/.exec(transactionResult)
  return match?.[1] ?? match?.[2] ?? null
}

const optionalString = (value: string | null | undefined): string | null =>
  value === null || value === undefined || value === "" ? null : value

/**
 * What one SwitchioPay answer amounts to, whatever was asked: a payment, a
 * closure or a refund. Each request turns it into its own error or value.
 */
type SwitchioOutcome<Parsed> =
  | { readonly type: "unreadable" }
  | {
      readonly type: "failed"
      readonly responseCode: string | null
      readonly responseMessage: string | null
    }
  | { readonly type: "approved"; readonly parsed: Parsed }

/**
 * The rules every SwitchioPay answer is read by, kept in one place because
 * the first and third are what payment/0006 rests on — an answer that does
 * not say what the terminal did is never a failure, since staff would then
 * charge the card again:
 *
 * 1. The failure code with no readable answer is unreadable. Android
 *    answers 0 (RESULT_CANCELED) with no data when the terminal app
 *    crashes, is killed, or, with the reorder-to-front flag, was already
 *    running and takes the card after the result has come back.
 * 2. Any other code but success is a failure.
 * 3. Success with no readable answer is unreadable.
 * 4. A `responseCode` other than `"OK"` is a failure, even on success.
 * 5. Anything else is approved.
 */
const classifySwitchioOutcome = <
  Parsed extends {
    readonly responseCode?: string | null | undefined
    readonly responseMessage?: string | null | undefined
  },
>(
  resultCode: number,
  parsed: Parsed | null
): SwitchioOutcome<Parsed> => {
  if (resultCode === switchioResultCode.failure && parsed === null) {
    return { type: "unreadable" }
  }
  const failed = {
    type: "failed",
    responseCode: optionalString(parsed?.responseCode),
    responseMessage: optionalString(parsed?.responseMessage),
  } as const
  if (resultCode !== switchioResultCode.success) return failed
  if (parsed === null) return { type: "unreadable" }
  if (failed.responseCode !== null && failed.responseCode !== "OK") {
    return failed
  }
  return { type: "approved", parsed }
}

const unreadableResult = (resultCode: number, rawResult: string | null) =>
  err(createSwitchioResultUnreadableError({ resultCode, rawResult }))

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

  const outcome = classifySwitchioOutcome(resultCode, parsed)
  if (outcome.type === "unreadable") {
    return unreadableResult(resultCode, transactionResult)
  }
  if (outcome.type === "failed") {
    return err(
      createSwitchioPaymentFailedError({
        resultCode,
        responseCode: outcome.responseCode,
        responseMessage: outcome.responseMessage,
      })
    )
  }

  const approved = outcome.parsed
  return ok({
    responseCode: optionalString(approved.responseCode),
    authCode: optionalString(approved.authCode),
    sequenceNumber: optionalString(approved.sequenceNumber),
    maskedPan: optionalString(approved.pan),
    cardLabel:
      optionalString(approved.appLabel) ?? optionalString(approved.brand),
    terminalId: optionalString(approved.terminalIdAcquirer),
    terminalDateTime: optionalString(approved.dateTimeTerminal),
    refundId: readRawRefundId(transactionResult),
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

/**
 * A closure result as the closure's store keeps it, with the id of the
 * closure it was launched as (payment/0008). Null for a result stored by a
 * build that minted no such id.
 */
export const SwitchioNativeRestoredClosureSchema =
  SwitchioNativeClosureResultSchema.extend({
    closureId: z.string().nullable().default(null),
  })
export type SwitchioNativeRestoredClosure = z.output<
  typeof SwitchioNativeRestoredClosureSchema
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
  /**
   * SwitchioPay was busy with something else and closed nothing: staff can
   * simply try again once it is free. Read here, so the UI needs no result
   * codes of its own.
   */
  readonly busy: boolean
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

  const outcome = classifySwitchioOutcome(resultCode, parsed)
  if (outcome.type === "unreadable") {
    return unreadableResult(resultCode, transactionResult)
  }
  if (outcome.type === "failed") {
    return err(
      createSwitchioClosureFailedError({
        resultCode,
        responseCode: outcome.responseCode,
        responseMessage: outcome.responseMessage,
        busy: resultCode === switchioResultCode.terminalBusy,
      })
    )
  }

  // The batch may well be closed, but without its totals there is nothing
  // to keep.
  const totals = outcome.parsed.batchTotals
  if (totals === null || totals === undefined) {
    return unreadableResult(resultCode, transactionResult)
  }

  return ok({
    ...totals,
    terminalDateTime: optionalString(outcome.parsed.dateTimeTerminal),
    responseMessage: optionalString(outcome.parsed.responseMessage),
  })
}

/**
 * Closes the batch of the SwitchioPay terminal on this phone. Kept apart from
 * {@link SwitchioTerminalDep} so that an app which only takes payments (web's
 * Capacitor bridge) need not implement it.
 */
export interface SwitchioClosureDep {
  readonly switchioClosure: {
    /**
     * `closureId` is the row the closure will be recorded as, stored with
     * its result before the terminal is launched, so the same closure
     * restored after a restart is that row again.
     */
    readonly close: (request: {
      readonly closureId: string
    }) => Promise<Result<SwitchioClosure, SwitchioClosureError>>
  }
}

/**
 * A reversal (ECR 5.13): takes back the whole payment `originalTransactionId`
 * names, tip included, on the terminal that took it and only until its batch
 * is closed. Both ids are required: without `originalTransactionId` the
 * terminal reverses its *last* transaction, whatever that is.
 */
export interface SwitchioReversalRequest {
  readonly transactionId: string
  readonly originalTransactionId: string
}

/**
 * A referral refund (ECR 5.17): money back to the card that paid, named by
 * the `refundId` the payment's result carried. The terminal declines it when
 * it cannot find that payment, so the money never goes to another card.
 */
export interface SwitchioReferralRefundRequest {
  readonly transactionId: string
  /** Minor units, at most what the payment charged. */
  readonly amount: number
  readonly currencyCode: number
  /** The payment's `refundId`, the terminal's 18 digits. */
  readonly refundId: string
  readonly invoiceNumber?: string
}

const createSwitchioRefundFailedError = defineError("SwitchioRefundFailed")<{
  readonly resultCode: number
  readonly responseCode: string | null
  readonly responseMessage: string | null
}>()
export type SwitchioRefundFailedError = ReturnType<
  typeof createSwitchioRefundFailedError
>

/**
 * The terminal answered busy or not initialised: codes known to come before
 * it does anything (payment/0006), so nothing was refunded.
 */
const createSwitchioRefundNotStartedError = defineError(
  "SwitchioRefundNotStarted"
)<{ readonly resultCode: number }>()
export type SwitchioRefundNotStartedError = ReturnType<
  typeof createSwitchioRefundNotStartedError
>

/**
 * A refund's failures. {@link SwitchioResultUnreadableError} means the money
 * may have gone back to the card, so it is never shown as a decline.
 */
export type SwitchioRefundError =
  | SwitchioUnavailableError
  | SwitchioRefundFailedError
  | SwitchioRefundNotStartedError
  | SwitchioResultUnreadableError

/** What a refund the terminal approved leaves for tracing it. */
export interface SwitchioCardRefundResult {
  readonly responseCode: string | null
  readonly authCode: string | null
  readonly sequenceNumber: string | null
  readonly maskedPan: string | null
  readonly terminalDateTime: string | null
}

const parseRefundResult = (
  transactionResult: string | null
): z.output<typeof SwitchioTransactionResultSchema> | null => {
  if (transactionResult === null || transactionResult === "") return null
  const result = z.safeDecode(SwitchioTransactionResultJson, transactionResult)
  return result.success ? result.data : null
}

const toCardRefundResult = (
  parsed: z.output<typeof SwitchioTransactionResultSchema>
): SwitchioCardRefundResult => ({
  responseCode: optionalString(parsed.responseCode),
  authCode: optionalString(parsed.authCode),
  sequenceNumber: optionalString(parsed.sequenceNumber),
  maskedPan: optionalString(parsed.pan),
  terminalDateTime: optionalString(parsed.dateTimeTerminal),
})

/**
 * Turns one refund intent result into a domain Result, by the payment's
 * rules ({@link interpretSwitchioPaymentResult}) with one more: busy and not
 * initialised are {@link SwitchioRefundNotStartedError}, not a decline, so the
 * attempt can be dropped rather than kept as failed.
 */
export const interpretSwitchioRefundResult = ({
  resultCode,
  transactionResult,
}: {
  readonly resultCode: number
  readonly transactionResult: string | null
}): Result<SwitchioCardRefundResult, SwitchioRefundError> => {
  const parsed = parseRefundResult(transactionResult)

  if (
    resultCode === switchioResultCode.terminalBusy ||
    resultCode === switchioResultCode.initFailure
  ) {
    return err(createSwitchioRefundNotStartedError({ resultCode }))
  }

  const outcome = classifySwitchioOutcome(resultCode, parsed)
  if (outcome.type === "unreadable") {
    return unreadableResult(resultCode, transactionResult)
  }
  if (outcome.type === "failed") {
    return err(
      createSwitchioRefundFailedError({
        resultCode,
        responseCode: outcome.responseCode,
        responseMessage: outcome.responseMessage,
      })
    )
  }
  return ok(toCardRefundResult(outcome.parsed))
}

/**
 * Reads a reversal's result by the refund's rules, with one more: a result
 * that says it is not a reversal (`reversal: false`) is unknown rather than
 * approved — whatever the terminal did, it was not this.
 */
export const interpretSwitchioReversalResult = (answer: {
  readonly resultCode: number
  readonly transactionResult: string | null
}): Result<SwitchioCardRefundResult, SwitchioRefundError> => {
  const result = interpretSwitchioRefundResult(answer)
  if (
    result.ok &&
    parseRefundResult(answer.transactionResult)?.reversal === false
  ) {
    return err(
      createSwitchioResultUnreadableError({
        resultCode: answer.resultCode,
        rawResult: answer.transactionResult,
      })
    )
  }
  return result
}

/**
 * What the terminal says about one of its transactions (`get_transaction`,
 * ECR 5.12), asked after a refund's own result was lost or unreadable.
 *
 * Only an approval is an answer. Tried on a device, the terminal answers
 * `FAILED`, "Transaction not found", for a reversal it had just approved, so
 * nothing else it says can be read as "not refunded": it is `unknown`, which
 * changes nothing. `reversed` is the transaction's `isReversed`, which tells
 * a reversal by the payment it took back.
 */
export type SwitchioTransactionLookup =
  | {
      readonly type: "approved"
      readonly result: SwitchioCardRefundResult
      readonly reversed: boolean
    }
  | { readonly type: "unknown" }

/**
 * Reads a `get_transaction` answer. Only an answer about the transaction
 * asked for counts: one naming another `transactionId` is `unknown`, so the
 * terminal's last transaction can never pass for this one.
 */
export const interpretSwitchioTransactionLookup = ({
  transactionId,
  resultCode,
  transactionResult,
}: {
  readonly transactionId: string
  readonly resultCode: number
  readonly transactionResult: string | null
}): SwitchioTransactionLookup => {
  const parsed = parseRefundResult(transactionResult)
  if (
    resultCode !== switchioResultCode.success ||
    parsed === null ||
    parsed.transactionId !== transactionId
  ) {
    return { type: "unknown" }
  }
  return optionalString(parsed.responseCode) === "OK"
    ? {
        type: "approved",
        result: toCardRefundResult(parsed),
        reversed: parsed.isReversed === true,
      }
    : { type: "unknown" }
}

/**
 * Takes payments back (reversal) or refunds them to the card (referral
 * refund) through the SwitchioPay terminal on this phone, and asks it what
 * became of one whose result was lost. Kept apart from
 * {@link SwitchioTerminalDep} and {@link SwitchioClosureDep}, so that an app
 * which only takes payments need not implement it.
 */
export interface SwitchioRefundDep {
  readonly switchioRefund: {
    readonly reverse: (
      request: SwitchioReversalRequest
    ) => Promise<Result<SwitchioCardRefundResult, SwitchioRefundError>>
    readonly referralRefund: (
      request: SwitchioReferralRefundRequest
    ) => Promise<Result<SwitchioCardRefundResult, SwitchioRefundError>>
    readonly lookup: (
      transactionId: string
    ) => Promise<SwitchioTransactionLookup>
  }
}
