import { err, ok, type Result } from "@evolu/common"
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js"
import { z } from "zod"

import { defineError } from "../../error.ts"
import { jsonCodec } from "../../zod-utils.ts"
import {
  type TransferPayload,
  TransferPayloadSchema,
} from "../nostr/nostr-account-transfer.ts"

/**
 * The app-to-app account request (account/0008): an app on the same phone —
 * Finito — asks Payky for its active account with an explicit Android intent
 * launched for a result, Payky shows who asks and the code the requester
 * shows, and on the user's approval answers with the same `TransferPayload`
 * the QR transfer (account/0001) sends.
 *
 * The "service" is the other app, so this sits under `integrations/`. The
 * native halves mirror these constants: Payky's `AccountShareActivity.java`
 * and Finito's `PaykyAccountRequestModule.kt`, which
 * `apps/web-app/src/platform/account-share.test.ts` and
 * `apps/native-app/src/platform/payky-account-request.test.ts` check.
 *
 * The answer travels only in the activity result, which Android hands to the
 * calling activity alone, so it is not encrypted; a flow without
 * `startActivityForResult` would need it to be.
 */

export const ACCOUNT_SHARE_PACKAGE = "me.payky"
export const ACCOUNT_SHARE_ACTION = "me.payky.action.SHARE_ACCOUNT"
export const ACCOUNT_SHARE_VERSION = 1

/** The names of the intent extras, both ways. */
export const accountShareExtras = {
  version: "v",
  requestId: "requestId",
  code: "code",
  requesterName: "requesterName",
  account: "account",
  error: "error",
} as const

/** How long Payky keeps a request open after it arrived. */
export const ACCOUNT_SHARE_REQUEST_LIFETIME_MS = 120_000

export const ACCOUNT_SHARE_REQUESTER_NAME_MAX_LENGTH = 64

/** Android's `Activity.RESULT_OK` and `RESULT_CANCELED`. */
export const ANDROID_RESULT_OK = -1
export const ANDROID_RESULT_CANCELED = 0

/** What Payky answers a request it does not approve with, in `error`. */
export const AccountShareRefusalSchema = z.enum([
  "rejected",
  "busy",
  "expired",
  "noAccount",
  "demo",
  "unsupportedVersion",
  "invalidRequest",
])
export type AccountShareRefusal = z.output<typeof AccountShareRefusalSchema>

/**
 * Why the requester got no account: a refusal Payky sent, `cancelled` for a
 * result with none (the user backed out, Android killed Payky), `invalid` for
 * an answer that does not decode or belongs to another request, and
 * `notInstalled` when no Payky could take the intent.
 */
export type AccountShareFailureReason =
  | AccountShareRefusal
  | "cancelled"
  | "invalid"
  | "notInstalled"

const createAccountShareFailedError = defineError("AccountShareFailed")<{
  readonly reason: AccountShareFailureReason
}>()
export type AccountShareFailedError = ReturnType<
  typeof createAccountShareFailedError
>

const RequestIdSchema = z.string().regex(/^[0-9a-f]{32}$/u)
const CodeSchema = z.string().regex(/^\d{6}$/u)

/** A request as the requester sends it and Payky reads it from the extras. */
export const AccountShareRequestSchema = z.object({
  v: z.literal(ACCOUNT_SHARE_VERSION),
  requestId: RequestIdSchema,
  code: CodeSchema,
  requesterName: z
    .string()
    .trim()
    .max(ACCOUNT_SHARE_REQUESTER_NAME_MAX_LENGTH)
    .nullable()
    .default(null),
})
export type AccountShareRequest = z.output<typeof AccountShareRequestSchema>

const createAccountShareRequestInvalidError = defineError(
  "AccountShareRequestInvalid"
)<{ readonly reason: "unsupportedVersion" | "invalidRequest" }>()
export type AccountShareRequestInvalidError = ReturnType<
  typeof createAccountShareRequestInvalidError
>

/**
 * Reads a request's extras; a request of another version is told so, so a
 * newer requester can say "update Payky" rather than "something went wrong".
 */
export const parseShareRequest = (
  raw: unknown
): Result<AccountShareRequest, AccountShareRequestInvalidError> => {
  const parsed = AccountShareRequestSchema.safeParse(raw)
  if (parsed.success) return ok(parsed.data)
  const version = z.object({ v: z.unknown() }).safeParse(raw)
  return err(
    createAccountShareRequestInvalidError({
      reason:
        version.success && version.data.v !== ACCOUNT_SHARE_VERSION
          ? "unsupportedVersion"
          : "invalidRequest",
    })
  )
}

/** The largest multiple of a million a `uint32` holds: values above it bias the code. */
const CODE_SAMPLING_LIMIT = Math.floor(2 ** 32 / 1_000_000) * 1_000_000

const randomUint32 = (): number => {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  if (value === undefined) throw new Error("getRandomValues returned nothing")
  return value
}

/**
 * Six uniformly distributed digits: a `uint32` past the last whole million
 * is drawn again rather than folded in, which would favour the low codes.
 */
export const createShareCode = (
  random: () => number = randomUint32
): string => {
  for (;;) {
    const value = random()
    if (value < CODE_SAMPLING_LIMIT) {
      return String(value % 1_000_000).padStart(6, "0")
    }
  }
}

/** A new request: a one-time id and the code the requester shows first. */
export const createShareRequest = (
  requesterName: string
): AccountShareRequest => ({
  v: ACCOUNT_SHARE_VERSION,
  requestId: bytesToHex(randomBytes(16)),
  code: createShareCode(),
  requesterName: requesterName.slice(
    0,
    ACCOUNT_SHARE_REQUESTER_NAME_MAX_LENGTH
  ),
})

/**
 * The approved answer's `account` extra. Its payload is checked on its own,
 * so an answer for another request is `invalid` whatever it carries.
 */
const AccountShareAnswerJson = jsonCodec(
  z.object({
    v: z.literal(ACCOUNT_SHARE_VERSION),
    requestId: RequestIdSchema,
    payload: z.unknown(),
  })
)

/** The approved answer's `account` extra; a one-way protocol payload. */
export const encodeShareAnswer = (answer: {
  readonly requestId: string
  readonly payload: TransferPayload
}): string =>
  JSON.stringify({
    v: ACCOUNT_SHARE_VERSION,
    requestId: answer.requestId,
    payload: answer.payload,
  })

/** What the requester's native half reads off the activity result. */
export interface AccountShareRawResult {
  readonly resultCode: number
  readonly account: string | null
  readonly error: string | null
}

/**
 * The account an answer carries, when it answers `requestId`; anything else
 * a failure with its reason. An unknown `error` reads as `cancelled`, like a
 * result without one.
 */
export const parseShareResult = (
  raw: AccountShareRawResult,
  requestId: string
): Result<TransferPayload, AccountShareFailedError> => {
  const fail = (reason: AccountShareFailureReason) =>
    err(createAccountShareFailedError({ reason }))

  if (raw.resultCode !== ANDROID_RESULT_OK) {
    const refusal = AccountShareRefusalSchema.safeParse(raw.error)
    return fail(refusal.success ? refusal.data : "cancelled")
  }
  if (raw.account === null) return fail("invalid")
  const answer = z.safeDecode(AccountShareAnswerJson, raw.account)
  if (!answer.success || answer.data.requestId !== requestId) {
    return fail("invalid")
  }
  const payload = TransferPayloadSchema.safeParse(answer.data.payload)
  return payload.success ? ok(payload.data) : fail("invalid")
}

/** A failure the requester's own launch produced. */
export const accountShareNotInstalled = (): AccountShareFailedError =>
  createAccountShareFailedError({ reason: "notInstalled" })
