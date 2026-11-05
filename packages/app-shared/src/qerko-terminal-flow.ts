import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  type QerkoCountry,
  QerkoCountrySchema,
  type QerkoEnvironment,
  type QerkoLocations,
  type QerkoNotStartedReason,
  type QerkoPaymentFailureReason,
  type QerkoRole,
  type QerkoStep,
  type QerkoTerminalStatus,
  type QerkoTerminals,
} from "@payky/core/integrations/qerko/qerko-client"
import type { QerkoConnectionStatus } from "@payky/core/integrations/qerko/qerko-connection-status"
import type {
  QerkoPairingCodeExpiredError,
  QerkoPairingInvalidCodeError,
  QerkoPairingMaxAttemptsReachedError,
} from "@payky/core/modules/qerko-plugin/qerko-plugin-actions"

/**
 * What the Qerko pairing wizard and settings screens share between web and
 * native: the choices they offer, the checks on what the merchant types, and
 * how each outcome reads (qerko/0001).
 */

/** What Qerko can pair with, in the order the wizard lists them. */
export const qerkoCountryOptions = QerkoCountrySchema.options

export const qerkoCountryLabelKeys = {
  CZ: "country.cz",
  SK: "country.sk",
  DE: "country.de",
  AT: "country.at",
  HU: "country.hu",
} satisfies Record<QerkoCountry, TranslationKey>

export const qerkoEnvironmentLabelKeys = {
  production: "settings.qerkoTerminal.environment.production",
  sandbox: "settings.qerkoTerminal.environment.sandbox",
} satisfies Record<QerkoEnvironment, TranslationKey>

/**
 * What the pairing wizard says that depends on what is paired (qerko/0007):
 * the company and code steps are the same for both, the last one is not —
 * the terminal to pay on, or the restaurant and the device serving Qerko
 * payments.
 */
export const qerkoPairingCopyKeys = {
  terminalPayments: {
    unpairedDescription: "settings.qerkoTerminal.unpaired.description",
    lastStepTitle: "settings.qerkoTerminal.terminals.title",
    lastStepDescription: "settings.qerkoTerminal.terminals.description",
  },
  standard: {
    unpairedDescription: "settings.qerkoPayment.unpaired.description",
    lastStepTitle: "settings.qerkoPayment.location.title",
    lastStepDescription: "settings.qerkoPayment.location.description",
  },
} satisfies Record<
  QerkoRole,
  Record<
    "unpairedDescription" | "lastStepTitle" | "lastStepDescription",
    TranslationKey
  >
>

/** A location a Qerko payment key may be paired with (qerko/0007). */
export interface QerkoLocationChoice {
  readonly locationId: string
  readonly name: string
  readonly address: string
}

export const selectableQerkoPaymentLocations = (
  locations: QerkoLocations
): ReadonlyArray<QerkoLocationChoice> =>
  locations.locations.map(({ id, name, address }) => ({
    locationId: id,
    name,
    address: `${address.street} ${address.descriptiveNumber}, ${address.zipCode} ${address.city}`,
  }))

/**
 * The location the chooser starts on: the one the key is already paired with,
 * else the only one there is; with several and none paired, the merchant picks.
 */
export const preselectedQerkoLocationId = (
  locations: QerkoLocations
): string | null =>
  locations.pairedLocationId ??
  (locations.locations.length === 1
    ? (locations.locations[0]?.id ?? null)
    : null)

export interface QerkoLocationsFailure {
  readonly key: TranslationKey
  /** Qerko refuses the key itself: only pairing anew helps. */
  readonly keyRejected: boolean
}

/** How a failed location list or location pairing reads. */
export const describeQerkoLocationsFailure = (error: {
  readonly type: string
  readonly status?: unknown
}): QerkoLocationsFailure =>
  isQerkoKeyRejected(error) || error.type === "QerkoPluginNotPaired"
    ? { key: "settings.qerkoPayment.location.keyRejected", keyRejected: true }
    : error.type === "QerkoHttpError" && error.status === 404
      ? { key: "settings.qerkoPayment.location.notFound", keyRejected: false }
      : { key: "settings.qerkoPayment.location.failed", keyRejected: false }

/** What keeps Qerko payments from being taken, the first one found. */
export type QerkoPaymentBlocker =
  | "noLocation"
  | "disabled"
  | "noDevice"
  | "stolen"
  | "unauthorized"

/**
 * Whether customers can pay through Qerko now, for the settings' summary.
 * It needs a location (qerko/0007), the method on and a device chosen to hold
 * the connection (qerko/0011); when that device is this one, its connection
 * is known too, while another device's is taken as up.
 */
export type QerkoPaymentReadiness =
  | { readonly type: "active" }
  | { readonly type: "connecting" }
  | { readonly type: "notAccepting"; readonly blocker: QerkoPaymentBlocker }

export const deriveQerkoPaymentReadiness = ({
  hasLocation,
  enabled,
  connectionDeviceId,
  thisDeviceId,
  connection,
}: {
  readonly hasLocation: boolean
  readonly enabled: boolean
  readonly connectionDeviceId: string | null
  readonly thisDeviceId: string
  readonly connection: QerkoConnectionStatus["type"]
}): QerkoPaymentReadiness => {
  if (!hasLocation) return { type: "notAccepting", blocker: "noLocation" }
  if (!enabled) return { type: "notAccepting", blocker: "disabled" }
  if (connectionDeviceId === null) {
    return { type: "notAccepting", blocker: "noDevice" }
  }
  if (connectionDeviceId !== thisDeviceId) return { type: "active" }
  if (connection === "connected") return { type: "active" }
  if (connection === "stolen" || connection === "unauthorized") {
    return { type: "notAccepting", blocker: connection }
  }
  return { type: "connecting" }
}

export const qerkoPaymentReadinessKeys = {
  active: "settings.qerkoPayment.readiness.active",
  connecting: "settings.qerkoPayment.readiness.connecting",
  notAccepting: "settings.qerkoPayment.readiness.notAccepting",
} satisfies Record<QerkoPaymentReadiness["type"], TranslationKey>

/** How this device's Qerko payment connection reads (qerko/0011). */
export const qerkoConnectionStatusKeys = {
  idle: "settings.qerkoPayment.connection.idle",
  connecting: "settings.qerkoPayment.connection.connecting",
  connected: "settings.qerkoPayment.connection.connected",
  reconnecting: "settings.qerkoPayment.connection.reconnecting",
  stolen: "settings.qerkoPayment.connection.stolen",
  unauthorized: "settings.qerkoPayment.connection.unauthorized",
} satisfies Record<QerkoConnectionStatus["type"], TranslationKey>

export const defaultQerkoCountry: QerkoCountry = "CZ"

/** Production unless the merchant opens "Additional options" and picks the sandbox. */
export const defaultQerkoEnvironment: QerkoEnvironment = "production"

export const QERKO_CODE_LENGTH = 4

export const isQerkoCodeComplete = (code: string): boolean =>
  new RegExp(`^\\d{${QERKO_CODE_LENGTH}}$`, "u").test(code)

/** The company id as typed, without the spaces people group it by; `null` when blank. */
export const parseQerkoIdentificationNumber = (
  input: string
): string | null => {
  const compact = input.replaceAll(/\s+/gu, "")
  return compact === "" || compact.length > 255 ? null : compact
}

type QerkoPairingRefusal =
  | QerkoPairingInvalidCodeError
  | QerkoPairingCodeExpiredError
  | QerkoPairingMaxAttemptsReachedError

const qerkoPairingRefusalKeys = {
  QerkoPairingInvalidCode: "settings.qerkoTerminal.code.invalid",
  QerkoPairingCodeExpired: "settings.qerkoTerminal.code.expired",
  QerkoPairingMaxAttemptsReached: "settings.qerkoTerminal.code.maxAttempts",
} satisfies Record<QerkoPairingRefusal["type"], TranslationKey>

export interface QerkoPairingFailure {
  readonly key: TranslationKey
  /** Attempts left, for the wrong-code message. */
  readonly attemptsLeft: number | null
  /** The code cannot be tried again: the wizard goes back to its first step. */
  readonly restart: boolean
}

/**
 * How a failed pairing reads: the three answers Qerko gives about the code,
 * or, for anything else (offline, Qerko down), one generic message that
 * keeps the code step.
 */
export const describeQerkoPairingFailure = (error: {
  readonly type: string
  readonly remainingAttempts?: number
}): QerkoPairingFailure => {
  if (error.type in qerkoPairingRefusalKeys) {
    const type = error.type as QerkoPairingRefusal["type"]
    return {
      key: qerkoPairingRefusalKeys[type],
      attemptsLeft:
        type === "QerkoPairingInvalidCode"
          ? (error.remainingAttempts ?? 0)
          : null,
      restart: type !== "QerkoPairingInvalidCode",
    }
  }
  return {
    key: "settings.qerkoTerminal.error.unreachable",
    attemptsLeft: null,
    restart: false,
  }
}

export interface QerkoTerminalChoice {
  readonly terminalId: string
  readonly tid: string
  readonly locationName: string
  readonly platform: "physical" | "softPos"
}

export interface QerkoLocationChoices {
  readonly locationId: string
  readonly locationName: string
  readonly terminals: ReadonlyArray<QerkoTerminalChoice>
}

/** Locations that have a terminal to pay on: only activated ones count. */
export const selectableQerkoLocations = (
  terminals: QerkoTerminals
): ReadonlyArray<QerkoLocationChoices> =>
  terminals.locations.flatMap((location) => {
    const enabled = location.terminals.filter(({ enabled }) => enabled)
    return enabled.length === 0
      ? []
      : [
          {
            locationId: location.id,
            locationName: location.name,
            terminals: enabled.map((terminal) => ({
              terminalId: terminal.id,
              tid: terminal.tid,
              locationName: location.name,
              platform: terminal.platform,
            })),
          },
        ]
  })

/** Qerko refuses the API key itself (revoked there): only pairing anew helps. */
export const isQerkoKeyRejected = (error: {
  readonly type: string
  readonly status?: unknown
}): boolean =>
  error.type === "QerkoHttpError" &&
  (error.status === 401 || error.status === 403)

export interface QerkoTerminalsFailure {
  readonly key: TranslationKey
  /** Qerko refuses the key itself: trying again is pointless, pairing anew is not. */
  readonly keyRejected: boolean
}

/**
 * How a failed terminal list reads: a key Qerko no longer accepts (revoked
 * in its dashboard) needs a new pairing, anything else (offline, Qerko down)
 * is worth another try.
 */
export const describeQerkoTerminalsFailure = (error: {
  readonly type: string
  readonly status?: unknown
}): QerkoTerminalsFailure =>
  isQerkoKeyRejected(error)
    ? { key: "settings.qerkoTerminal.terminals.keyRejected", keyRejected: true }
    : { key: "settings.qerkoTerminal.terminals.failed", keyRejected: false }

const qerkoTerminalStatusKeys = {
  status: "settings.qerkoTerminal.test.connected",
  terminalBusy: "settings.qerkoTerminal.test.busy",
  terminalNotActivated: "settings.qerkoTerminal.test.notActivated",
  terminalNotConnected: "settings.qerkoTerminal.test.notConnected",
  unknownTerminal: "settings.qerkoTerminal.test.unknownTerminal",
  upstreamError: "settings.qerkoTerminal.test.upstreamError",
  upstreamTimeout: "settings.qerkoTerminal.test.upstreamTimeout",
} satisfies Record<QerkoTerminalStatus["type"], TranslationKey>

/** What "Test connection" tells the merchant about the terminal. */
export const describeQerkoTerminalStatus = (
  status: QerkoTerminalStatus
): { readonly key: TranslationKey; readonly ok: boolean } =>
  status.type === "status"
    ? status.authorizationServerConnection === "error"
      ? { key: "settings.qerkoTerminal.test.bankUnreachable", ok: false }
      : { key: qerkoTerminalStatusKeys.status, ok: true }
    : { key: qerkoTerminalStatusKeys[status.type], ok: false }

/** What the terminal is doing while a payment is pending, as the screen words it. */
export const qerkoStepKeys = {
  connecting: "paymentWait.qerko.step.connecting",
  waitingForCard: "paymentWait.qerko.step.waitingForCard",
  waitingForPin: "paymentWait.qerko.step.waitingForPin",
  waitingForCustomer: "paymentWait.qerko.step.waitingForCustomer",
  authorizing: "paymentWait.qerko.step.authorizing",
  finishing: "paymentWait.qerko.step.finishing",
} satisfies Record<QerkoStep, TranslationKey>

/** Once the card is authorizing the payment is out of anyone's hands. */
export const isQerkoStepCancellable = (step: QerkoStep): boolean =>
  step === "connecting" ||
  step === "waitingForCard" ||
  step === "waitingForPin" ||
  step === "waitingForCustomer"

const qerkoFailureKeys = {
  declined: "paymentWait.qerko.failed.declined",
  cancelled: "paymentWait.qerko.failed.cancelled",
  reversed: "paymentWait.qerko.failed.reversed",
} satisfies Record<QerkoPaymentFailureReason, TranslationKey>

const qerkoNotStartedKeys = {
  busy: "paymentWait.qerko.notStarted.busy",
  terminalBusy: "paymentWait.qerko.notStarted.busy",
  terminalNotActivated: "paymentWait.qerko.notStarted.notActivated",
  terminalNotConnected: "paymentWait.qerko.notStarted.notConnected",
  unknownTerminal: "paymentWait.qerko.notStarted.unknownTerminal",
  upstreamTimeout: "paymentWait.qerko.notStarted.timeout",
  duplicateTransaction: "paymentWait.qerko.error.generic",
  notStarted: "paymentWait.qerko.error.generic",
  upstreamError: "paymentWait.qerko.error.generic",
} satisfies Record<QerkoNotStartedReason, TranslationKey>

/**
 * Failures that carry no further detail. `QerkoAttemptUnresolved` is shown
 * by its own "check the terminal" state, but an attempt refused for it still
 * needs a word here.
 */
const qerkoPaymentErrorKeys = {
  PaymentNotFound: "paymentWait.qerko.error.generic",
  PaymentNotPayable: "paymentWait.qerko.error.notPayable",
  QerkoAttemptUnresolved: "paymentWait.qerko.error.attemptRunning",
  QerkoTerminalAccountNotFound: "paymentWait.qerko.error.generic",
  AccountCurrencyMismatch: "paymentWait.qerko.error.generic",
  QerkoPluginNotPaired: "paymentWait.qerko.error.notPaired",
  QerkoHttpError: "paymentWait.qerko.error.unreachable",
  QerkoApiError: "paymentWait.qerko.error.unreachable",
  FetchError: "paymentWait.qerko.error.unreachable",
} satisfies Record<string, TranslationKey>

/**
 * How a failed start or poll reads. A refusal to start and a definite
 * decline name their reason; the rest fall back to the lookup above, and
 * anything unknown to the generic message, so a new error type never leaves
 * the screen silent.
 */
export const describeQerkoPaymentError = (error: {
  readonly type: string
  readonly reason?: string
  readonly status?: unknown
}): TranslationKey => {
  if (isQerkoKeyRejected(error)) return "paymentWait.qerko.error.keyRejected"
  if (
    error.type === "QerkoTerminalNotStarted" ||
    error.type === "QerkoTerminalRefundNotStarted"
  ) {
    return qerkoNotStartedKeys[
      (error.reason ?? "notStarted") as QerkoNotStartedReason
    ]
  }
  if (error.type === "QerkoTerminalPaymentFailed") {
    return qerkoFailureKeys[
      (error.reason ?? "declined") as QerkoPaymentFailureReason
    ]
  }
  return (
    (qerkoPaymentErrorKeys as Record<string, TranslationKey | undefined>)[
      error.type
    ] ?? "paymentWait.qerko.error.generic"
  )
}
