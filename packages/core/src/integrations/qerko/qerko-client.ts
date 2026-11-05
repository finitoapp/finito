import { err, ok, type Task } from "@evolu/common"
import { z } from "zod"
import {
  type FetchDep,
  type FetchError,
  fetchAndValidateJson,
} from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  decimalAmountToMinorUnits,
  minorUnitsToDecimalString,
} from "../../modules/shared/money.ts"
import { Integer } from "../../modules/shared/schema.ts"
import { type QerkoWirePayment, QerkoWirePaymentSchema } from "./qerko-rpc.ts"

/**
 * Qerko POS API v4 (`docs/qerko.md`): remote control of a payment terminal
 * over HTTP. Every call is a `POST` with a JSON body; the terminal endpoints
 * authenticate with `Pos-Id` plus the API key as a bearer token, the two
 * pairing endpoints with `Pos-Id` alone. The contract is the OpenAPI document
 * at `<base URL>/openapi.json`.
 */

export const QerkoEnvironmentSchema = z.enum(["production", "sandbox"])
export type QerkoEnvironment = z.output<typeof QerkoEnvironmentSchema>

export const qerkoBaseUrls = {
  production: "https://qerko.com/api/v4/pos",
  sandbox: "https://sandbox.qerko.com/api/v4/pos",
} satisfies Record<QerkoEnvironment, string>

/**
 * Qerko's POS websocket (`qerko-rpc.ts`). REST is v4, but Qerko serves the
 * websocket only under v2/v3, so its path is not the REST base's.
 */
export const qerkoSocketUrls = {
  production: "wss://qerko.com/api/v2/pos/ws",
  sandbox: "wss://sandbox.qerko.com/api/v2/pos/ws",
} satisfies Record<QerkoEnvironment, string>

/** The websocket of an environment, under the e2e builds' base URL when set. */
export const getQerkoSocketUrl = (
  qerkoApi: QerkoApiDep["qerkoApi"],
  environment: QerkoEnvironment
): string =>
  qerkoApi.baseUrl === undefined
    ? qerkoSocketUrls[environment]
    : `${qerkoApi.baseUrl.replace(/^http/, "ws")}/ws`

/**
 * The host of a Qerko payment's QR code. It is production's for both
 * environments: the Qerko app in sandbox mode reads the same codes.
 */
export const qerkoQrBaseUrl = "https://qerko.com"

/**
 * What a Qerko payment's QR code holds: the restaurant, and after `~` the
 * identifier Qerko hands back to `searchBills` — the payment's id.
 */
export const createQerkoPaymentQrPayload = ({
  restaurantId,
  qrIdentifier,
}: {
  readonly restaurantId: string
  readonly qrIdentifier: string
}): string => `${qerkoQrBaseUrl}/~qr/pos/${restaurantId}~${qrIdentifier}`

/**
 * What a pairing's API key may do. Each Qerko payment method pairs on its
 * own (qerko/0007): `terminalPayments` drives the card terminal, `standard`
 * serves Qerko payments over the POS websocket and the REST calls beside it.
 */
export const QerkoRoleSchema = z.enum(["terminalPayments", "standard"])
export type QerkoRole = z.output<typeof QerkoRoleSchema>

/** The currencies Payky has an account kind for; the API also knows HUF/PLN. */
export const QerkoCurrencySchema = z.enum(["CZK", "EUR", "USD"])
export type QerkoCurrency = z.output<typeof QerkoCurrencySchema>

export const QerkoCountrySchema = z.enum(["CZ", "SK", "DE", "AT", "HU"])
export type QerkoCountry = z.output<typeof QerkoCountrySchema>

export interface QerkoApiDep {
  readonly qerkoApi: {
    readonly posId: string
    /** Replaces the host of both environments; set only by the e2e builds. */
    readonly baseUrl?: string
  }
}

export const createQerkoApiDep = ({
  posId,
  baseUrl,
}: {
  readonly posId: string
  readonly baseUrl?: string | undefined
}): QerkoApiDep => ({
  qerkoApi: { posId, ...(baseUrl === undefined ? {} : { baseUrl }) },
})

export interface QerkoCredentials {
  readonly apiKey: string
  readonly environment: QerkoEnvironment
}

const createQerkoHttpError = defineError("QerkoHttpError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
}>()
export type QerkoHttpError = ReturnType<typeof createQerkoHttpError>

const createQerkoApiError = defineError("QerkoApiError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
  readonly cause?: unknown
}>()
export type QerkoApiError = ReturnType<typeof createQerkoApiError>

export type QerkoClientError = QerkoHttpError | QerkoApiError | FetchError

const zeroDecimalPattern = /^0+(\.0+)?$/

/** A decimal string from Qerko to minor units; zero is a valid tip. */
const decimalToMinor = (
  value: string,
  currency: QerkoCurrency
): number | null =>
  zeroDecimalPattern.test(value)
    ? 0
    : decimalAmountToMinorUnits({ currency, value })

const TransactionIdSchema = z.string().min(1)

const timestamp = z.string().min(1)

const ReceiptSchema = z.object({
  merchantId: z.string(),
  terminalId: z.string(),
  sequenceNumber: z.string(),
  terminalDateTime: timestamp.nullable(),
  refundId: z.string().nullable(),
})

const PaymentStepSchema = z.enum([
  "connecting",
  "waitingForCard",
  "waitingForPin",
  "waitingForCustomer",
  "authorizing",
  "finishing",
])
export type QerkoStep = z.output<typeof PaymentStepSchema>

export const QerkoPaymentFailureReasonSchema = z.enum([
  "declined",
  "cancelled",
  "reversed",
])
export type QerkoPaymentFailureReason = z.output<
  typeof QerkoPaymentFailureReasonSchema
>

const QerkoPaymentWireSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("pending"),
    transactionId: TransactionIdSchema,
    step: PaymentStepSchema,
  }),
  z.object({
    status: z.literal("approved"),
    transactionId: TransactionIdSchema,
    currency: QerkoCurrencySchema,
    amount: z.string(),
    chargedAmount: z.string(),
    chargedTipAmount: z.string(),
    authorizationCode: z.string(),
    card: z.object({
      brand: z.string(),
      maskedPan: z.string(),
      entryMode: z.enum(["contactless", "chip", "magstripe"]),
    }),
    receipt: ReceiptSchema,
  }),
  z.object({
    status: z.literal("failed"),
    transactionId: TransactionIdSchema,
    reason: QerkoPaymentFailureReasonSchema,
  }),
  z.object({
    status: z.literal("unknown"),
    transactionId: TransactionIdSchema,
  }),
])

export type QerkoPayment =
  | { readonly status: "pending"; readonly step: QerkoStep }
  | {
      readonly status: "approved"
      readonly currency: QerkoCurrency
      /** Charged to the card, tip included (differs from the request when the customer tipped). */
      readonly chargedAmount: Integer
      readonly chargedTipAmount: Integer
      readonly authorizationCode: string
      readonly cardBrand: string
      readonly maskedPan: string
      readonly entryMode: "contactless" | "chip" | "magstripe"
      readonly merchantId: string
      readonly terminalId: string
      readonly sequenceNumber: string
      readonly terminalDateTime: string | null
      readonly refundId: string | null
    }
  | { readonly status: "failed"; readonly reason: QerkoPaymentFailureReason }
  | { readonly status: "unknown" }

const toPayment = (
  wire: z.output<typeof QerkoPaymentWireSchema>
): QerkoPayment | null => {
  if (wire.status === "pending") return { status: "pending", step: wire.step }
  if (wire.status === "failed") return { status: "failed", reason: wire.reason }
  if (wire.status === "unknown") return { status: "unknown" }

  const charged = decimalToMinor(wire.chargedAmount, wire.currency)
  const tip = decimalToMinor(wire.chargedTipAmount, wire.currency)
  if (charged === null || tip === null) return null
  return {
    status: "approved",
    currency: wire.currency,
    chargedAmount: Integer(charged),
    chargedTipAmount: Integer(tip),
    authorizationCode: wire.authorizationCode,
    cardBrand: wire.card.brand,
    maskedPan: wire.card.maskedPan,
    entryMode: wire.card.entryMode,
    merchantId: wire.receipt.merchantId,
    terminalId: wire.receipt.terminalId,
    sequenceNumber: wire.receipt.sequenceNumber,
    terminalDateTime: wire.receipt.terminalDateTime,
    refundId: wire.receipt.refundId,
  }
}

const RefundWireSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("pending"),
    transactionId: TransactionIdSchema,
    step: PaymentStepSchema,
  }),
  z.object({
    status: z.literal("approved"),
    transactionId: TransactionIdSchema,
  }),
  z.object({
    status: z.literal("failed"),
    transactionId: TransactionIdSchema,
    reason: z.enum(["declined", "cancelled"]),
  }),
  z.object({
    status: z.literal("unknown"),
    transactionId: TransactionIdSchema,
  }),
])

export type QerkoRefund =
  | { readonly status: "pending"; readonly step: QerkoStep }
  | { readonly status: "approved" }
  | { readonly status: "failed"; readonly reason: "declined" | "cancelled" }
  | { readonly status: "unknown" }

const toRefund = (wire: z.output<typeof RefundWireSchema>): QerkoRefund => {
  if (wire.status === "pending") return { status: "pending", step: wire.step }
  if (wire.status === "failed") return { status: "failed", reason: wire.reason }
  return { status: wire.status }
}

/** Why `create-terminal-*` did not start the operation: the response `type`. */
export const QerkoNotStartedReasonSchema = z.enum([
  "busy",
  "duplicateTransaction",
  "notStarted",
  "terminalBusy",
  "terminalNotActivated",
  "terminalNotConnected",
  "unknownTerminal",
  "upstreamError",
  "upstreamTimeout",
])
export type QerkoNotStartedReason = z.output<typeof QerkoNotStartedReasonSchema>

const post =
  <TSchema extends z.ZodType>({
    environment,
    path,
    apiKey,
    body,
    schema,
    what,
  }: {
    readonly environment: QerkoEnvironment
    readonly path: string
    readonly apiKey?: string
    readonly body: unknown
    readonly schema: TSchema
    readonly what: string
  }): Task<z.output<TSchema>, QerkoClientError, QerkoApiDep & FetchDep> =>
  async (run) =>
    run(
      fetchAndValidateJson({
        url: `${run.deps.qerkoApi.baseUrl ?? qerkoBaseUrls[environment]}/${path}`,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "pos-id": run.deps.qerkoApi.posId,
            ...(apiKey === undefined
              ? {}
              : { authorization: `Bearer ${apiKey}` }),
          },
          body: JSON.stringify(body),
        },
        schema,
        onHttpError: ({ status, responseBody }) =>
          createQerkoHttpError({
            message: `Qerko ${what} request failed: ${status}`,
            status,
            responseBody,
          }),
        onResponseError: ({ status, responseBody, cause }) =>
          createQerkoApiError({
            message: `Invalid Qerko ${what} response.`,
            status,
            responseBody,
            cause,
          }),
      })
    )

const invalidAmount = (what: string) =>
  createQerkoApiError({
    message: `Invalid Qerko ${what} amount.`,
    status: 200,
    responseBody: "",
  })

// Pairing

export const requestQerkoPairing =
  ({
    environment,
    identificationNumber,
    country,
    role,
  }: {
    readonly environment: QerkoEnvironment
    readonly identificationNumber: string
    readonly country: QerkoCountry
    readonly role: QerkoRole
  }): Task<
    {
      readonly pairingRequestId: string
      readonly resendAvailableInSeconds: number
    },
    QerkoClientError,
    QerkoApiDep & FetchDep
  > =>
  async (run) =>
    run(
      post({
        environment,
        path: "request-pairing",
        body: {
          identificationNumber,
          country,
          roles: [role],
        },
        schema: z.object({
          pairingRequestId: z.string().min(1),
          resendAvailableInSeconds: z.number().int().nonnegative(),
        }),
        what: "pairing request",
      })
    )

const ConfirmPairingResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ok"),
    apiKey: z.object({ token: z.string().min(1), name: z.string() }),
  }),
  z.object({
    type: z.literal("invalidCode"),
    remainingAttempts: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("codeExpired") }),
  z.object({ type: z.literal("maxAttemptsReached") }),
])

export type QerkoConfirmPairingResult = z.output<
  typeof ConfirmPairingResponseSchema
>

export const confirmQerkoPairing = ({
  environment,
  pairingRequestId,
  code,
  name,
}: {
  readonly environment: QerkoEnvironment
  readonly pairingRequestId: string
  readonly code: string
  readonly name: string
}): Task<QerkoConfirmPairingResult, QerkoClientError, QerkoApiDep & FetchDep> =>
  post({
    environment,
    path: "confirm-pairing",
    body: { pairingRequestId, code, name },
    schema: ConfirmPairingResponseSchema,
    what: "pairing confirmation",
  })

// Locations (the standard role)

const LocationsResponseSchema = z.object({
  legalEntity: z.object({
    id: z.string(),
    name: z.string(),
    identificationNumber: z.string(),
    country: QerkoCountrySchema,
  }),
  locations: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      address: z.object({
        street: z.string(),
        descriptiveNumber: z.string(),
        city: z.string(),
        zipCode: z.string(),
        country: QerkoCountrySchema,
      }),
    })
  ),
  pairedLocationId: z.string().nullable(),
})

/**
 * The company a `standard` key belongs to and its locations (`get-locations`).
 * A freshly issued key is paired with no location, and Qerko refuses the rest
 * of its API until it is (`pairQerkoLocation`, qerko/0007); this call is the
 * one that works before, so it is also the first proof the key works.
 */
export type QerkoLocations = z.output<typeof LocationsResponseSchema>

export const getQerkoLocations = (
  credentials: QerkoCredentials
): Task<QerkoLocations, QerkoClientError, QerkoApiDep & FetchDep> =>
  post({
    environment: credentials.environment,
    apiKey: credentials.apiKey,
    path: "get-locations",
    body: {},
    schema: LocationsResponseSchema,
    what: "locations",
  })

/**
 * Pairs a `standard` key with one of its company's locations. Its id is the
 * restaurant a Qerko payment's QR code names. Pairing the location the key
 * already has changes nothing; Qerko answers an unknown one with 404.
 */
export const pairQerkoLocation =
  ({
    credentials,
    locationId,
  }: {
    readonly credentials: QerkoCredentials
    readonly locationId: string
  }): Task<void, QerkoClientError, QerkoApiDep & FetchDep> =>
  async (run) => {
    const paired = await run(
      post({
        environment: credentials.environment,
        apiKey: credentials.apiKey,
        path: "pair-location",
        body: { locationId },
        schema: z.object({ status: z.literal("Accepted") }),
        what: "location pairing",
      })
    )
    return paired.ok ? ok() : paired
  }

// Qerko payments (the standard role)

/**
 * One Qerko payment (`get-payment`), what a Qerko payment's state is read
 * from when `paymentClosed` never arrived (qerko/0012).
 */
export const getQerkoPayment = ({
  credentials,
  paymentId,
}: {
  readonly credentials: QerkoCredentials
  readonly paymentId: string
}): Task<QerkoWirePayment, QerkoClientError, QerkoApiDep & FetchDep> =>
  post({
    environment: credentials.environment,
    apiKey: credentials.apiKey,
    path: "get-payment",
    body: { paymentId },
    schema: QerkoWirePaymentSchema,
    what: "payment",
  })

/**
 * Cancels a paid Qerko payment, which refunds all of it (`cancel-payment`):
 * Qerko knows no partial refund. Done once the answer says `CANCELLED`.
 */
export const cancelQerkoPayment = ({
  credentials,
  paymentId,
}: {
  readonly credentials: QerkoCredentials
  readonly paymentId: string
}): Task<QerkoWirePayment, QerkoClientError, QerkoApiDep & FetchDep> =>
  post({
    environment: credentials.environment,
    apiKey: credentials.apiKey,
    path: "cancel-payment",
    body: { paymentId },
    schema: QerkoWirePaymentSchema,
    what: "payment cancellation",
  })

// Terminals

const TerminalsResponseSchema = z.object({
  legalEntity: z.object({
    name: z.string(),
    identificationNumber: z.string(),
    country: QerkoCountrySchema,
  }),
  locations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      terminals: z.array(
        z.object({
          id: z.string(),
          tid: z.string(),
          enabled: z.boolean(),
          platform: z.enum(["physical", "softPos"]),
        })
      ),
    })
  ),
})

export type QerkoTerminals = z.output<typeof TerminalsResponseSchema>

export const getQerkoTerminals = (
  credentials: QerkoCredentials
): Task<QerkoTerminals, QerkoClientError, QerkoApiDep & FetchDep> =>
  post({
    environment: credentials.environment,
    apiKey: credentials.apiKey,
    path: "get-terminals",
    body: {},
    schema: TerminalsResponseSchema,
    what: "terminals",
  })

const TerminalStatusResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    authorizationServerConnection: z.enum(["notChecked", "ok", "error"]),
  }),
  z.object({ type: z.literal("terminalBusy") }),
  z.object({ type: z.literal("terminalNotActivated") }),
  z.object({ type: z.literal("terminalNotConnected") }),
  z.object({ type: z.literal("unknownTerminal") }),
  z.object({ type: z.literal("upstreamError") }),
  z.object({ type: z.literal("upstreamTimeout") }),
])

export type QerkoTerminalStatus = z.output<typeof TerminalStatusResponseSchema>

export const getQerkoTerminalStatus = ({
  credentials,
  terminalId,
}: {
  readonly credentials: QerkoCredentials
  readonly terminalId: string
}): Task<QerkoTerminalStatus, QerkoClientError, QerkoApiDep & FetchDep> =>
  post({
    environment: credentials.environment,
    apiKey: credentials.apiKey,
    path: "get-terminal-status",
    body: { terminalId },
    schema: TerminalStatusResponseSchema,
    what: "terminal status",
  })

// Payments

const notStartedTypes = QerkoNotStartedReasonSchema.options

const CreatePaymentResponseSchema = z.union([
  z.object({ type: z.literal("started"), payment: QerkoPaymentWireSchema }),
  z.object({ type: z.enum(notStartedTypes) }),
])

export type QerkoCreateResult<TOperation> =
  | { readonly type: "started"; readonly operation: TOperation }
  | { readonly type: "notStarted"; readonly reason: QerkoNotStartedReason }

export const createQerkoTerminalPayment =
  ({
    credentials,
    terminalId,
    transactionId,
    amount,
    tipAmount,
    currency,
    referenceId,
  }: {
    readonly credentials: QerkoCredentials
    readonly terminalId: string
    readonly transactionId: string
    /** Minor units, tip included. */
    readonly amount: Integer
    readonly tipAmount?: Integer
    readonly currency: QerkoCurrency
    readonly referenceId?: string
  }): Task<
    QerkoCreateResult<QerkoPayment>,
    QerkoClientError,
    QerkoApiDep & FetchDep
  > =>
  async (run) => {
    const response = await run(
      post({
        environment: credentials.environment,
        apiKey: credentials.apiKey,
        path: "create-terminal-payment",
        body: {
          terminalId,
          transactionId,
          amount: minorUnitsToDecimalString({ value: amount, currency }),
          currency,
          ...(tipAmount === undefined || tipAmount === 0
            ? {}
            : {
                tipAmount: minorUnitsToDecimalString({
                  value: tipAmount,
                  currency,
                }),
              }),
          ...(referenceId === undefined ? {} : { referenceId }),
        },
        schema: CreatePaymentResponseSchema,
        what: "payment",
      })
    )
    if (!response.ok) return response
    if (response.value.type !== "started") {
      return ok({ type: "notStarted", reason: response.value.type })
    }
    const payment = toPayment(response.value.payment)
    if (payment === null) return err(invalidAmount("payment"))
    return ok({ type: "started", operation: payment })
  }

const PaymentStatusResponseSchema = z.union([
  z.object({ type: z.literal("found"), payment: QerkoPaymentWireSchema }),
  z.object({ type: z.literal("unknownTransaction") }),
])

export type QerkoStatusResult<TOperation> =
  | { readonly type: "found"; readonly operation: TOperation }
  | { readonly type: "unknownTransaction" }

export const getQerkoTerminalPaymentStatus =
  ({
    credentials,
    transactionId,
  }: {
    readonly credentials: QerkoCredentials
    readonly transactionId: string
  }): Task<
    QerkoStatusResult<QerkoPayment>,
    QerkoClientError,
    QerkoApiDep & FetchDep
  > =>
  async (run) => {
    const response = await run(
      post({
        environment: credentials.environment,
        apiKey: credentials.apiKey,
        path: "get-terminal-payment-status",
        body: { transactionId },
        schema: PaymentStatusResponseSchema,
        what: "payment status",
      })
    )
    if (!response.ok) return response
    if (response.value.type !== "found") {
      return ok({ type: "unknownTransaction" })
    }
    const payment = toPayment(response.value.payment)
    if (payment === null) return err(invalidAmount("payment"))
    return ok({ type: "found", operation: payment })
  }

const CancelResponseSchema = z.object({
  type: z.enum(["cancelling", "notCancellable", "unknownTransaction"]),
})

export type QerkoCancelResult = z.output<typeof CancelResponseSchema>["type"]

/** Asks the terminal to cancel; the outcome shows up in the payment status. */
export const cancelQerkoTerminalPayment =
  ({
    credentials,
    transactionId,
  }: {
    readonly credentials: QerkoCredentials
    readonly transactionId: string
  }): Task<QerkoCancelResult, QerkoClientError, QerkoApiDep & FetchDep> =>
  async (run) => {
    const response = await run(
      post({
        environment: credentials.environment,
        apiKey: credentials.apiKey,
        path: "cancel-terminal-payment",
        body: { transactionId },
        schema: CancelResponseSchema,
        what: "payment cancellation",
      })
    )
    return response.ok ? ok(response.value.type) : response
  }

// Refunds

const CreateRefundResponseSchema = z.union([
  z.object({ type: z.literal("started"), refund: RefundWireSchema }),
  z.object({ type: z.enum(notStartedTypes) }),
])

export const createQerkoTerminalRefund =
  ({
    credentials,
    terminalId,
    transactionId,
    refundId,
    amount,
    currency,
    referenceId,
  }: {
    readonly credentials: QerkoCredentials
    readonly terminalId: string
    readonly transactionId: string
    /** `receipt.refundId` of the payment being refunded. */
    readonly refundId: string
    readonly amount: Integer
    readonly currency: QerkoCurrency
    readonly referenceId?: string
  }): Task<
    QerkoCreateResult<QerkoRefund>,
    QerkoClientError,
    QerkoApiDep & FetchDep
  > =>
  async (run) => {
    const response = await run(
      post({
        environment: credentials.environment,
        apiKey: credentials.apiKey,
        path: "create-terminal-refund",
        body: {
          terminalId,
          transactionId,
          refundId,
          amount: minorUnitsToDecimalString({ value: amount, currency }),
          currency,
          ...(referenceId === undefined ? {} : { referenceId }),
        },
        schema: CreateRefundResponseSchema,
        what: "refund",
      })
    )
    if (!response.ok) return response
    if (response.value.type !== "started") {
      return ok({ type: "notStarted", reason: response.value.type })
    }
    return ok({ type: "started", operation: toRefund(response.value.refund) })
  }

const RefundStatusResponseSchema = z.union([
  z.object({ type: z.literal("found"), refund: RefundWireSchema }),
  z.object({ type: z.literal("unknownTransaction") }),
])

export const getQerkoTerminalRefundStatus =
  ({
    credentials,
    transactionId,
  }: {
    readonly credentials: QerkoCredentials
    readonly transactionId: string
  }): Task<
    QerkoStatusResult<QerkoRefund>,
    QerkoClientError,
    QerkoApiDep & FetchDep
  > =>
  async (run) => {
    const response = await run(
      post({
        environment: credentials.environment,
        apiKey: credentials.apiKey,
        path: "get-terminal-refund-status",
        body: { transactionId },
        schema: RefundStatusResponseSchema,
        what: "refund status",
      })
    )
    if (!response.ok) return response
    if (response.value.type !== "found") {
      return ok({ type: "unknownTransaction" })
    }
    return ok({ type: "found", operation: toRefund(response.value.refund) })
  }
