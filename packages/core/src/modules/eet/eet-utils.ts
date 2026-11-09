import { createIdFromString } from "@evolu/common"
import { addDays, addHours, format, parseISO } from "date-fns"
import { z } from "zod"
import { jsonCodec } from "../../zod-utils.ts"
import type { AccountKind } from "../account/account-types.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { ReconciliationClaimId } from "../reconciliation-claim/reconciliation-claim-types.ts"
import type { RefundId } from "../refund/refund-types.ts"
import {
  type ClaimedAmount,
  sumDistinctClaimedAmounts,
  toPaymentCurrencyAmount,
} from "../shared/claimed-amount.ts"
import {
  type FiatCurrency,
  NonNegativeInteger,
  TimestampMs,
} from "../shared/schema.ts"
import {
  type EetAttemptResult,
  type EetBase64,
  EetBase64Schema,
  type EetCashRegisterId,
  EetCashRegisterIdSchema,
  type EetCertificateExpiry,
  type EetCertificateId,
  type EetConfigurationGap,
  type EetDateTime,
  EetDateTimeSchema,
  type EetEnvironment,
  type EetEstablishmentId,
  type EetReversalId,
  type EetSaleId,
  type EetSaleStatus,
  type EetSettingsId,
  type EetTipOwner,
  type EetUnsupportedReason,
  type EetWarning,
  EetWarningSchema,
} from "./eet-types.ts"

export const eetSettingsId: EetSettingsId =
  createIdFromString<"EetSettings">("payky-eet-settings")

export const createEetSaleId = ({
  paymentId,
  accountTransactionId,
}: {
  readonly paymentId: PaymentId
  readonly accountTransactionId: AccountTransactionId
}): EetSaleId =>
  createIdFromString<"EetSale">(`eetSale:${paymentId}:${accountTransactionId}`)

export const createEetExtraSaleId = ({
  paymentId,
  extraFrom,
}: {
  readonly paymentId: PaymentId
  readonly extraFrom: NonNegativeInteger
}): EetSaleId =>
  createIdFromString<"EetSale">(`eetSale:${paymentId}:extra:${extraFrom}`)

/**
 * What a refund's storno may reverse before the cap of what the payment's
 * sales reported (eet/0011): the money the refund handed back. From the cash
 * register that is the cash handed out (refund/0012), else the refund's
 * amount, also for a cash refund an older version wrote without it. A tip
 * refund reverses only a tip the sale reported: all it handed back when the
 * sale reported the whole tip, nothing above the reported tip otherwise.
 */
export const deriveEetReversibleRefundAmount = ({
  amount,
  cashHandedAmount,
  isTip,
  reportedTipAmount,
}: {
  readonly amount: NonNegativeInteger
  readonly cashHandedAmount: NonNegativeInteger | null
  readonly isTip: boolean
  /** The tip the refunded payment's sale reports, `null` if it never recorded one. */
  readonly reportedTipAmount: NonNegativeInteger | null
}): NonNegativeInteger => {
  const handed = cashHandedAmount ?? amount
  if (!isTip) return handed
  const reportedTip = reportedTipAmount ?? 0
  return NonNegativeInteger(
    reportedTip >= amount ? handed : Math.min(handed, reportedTip)
  )
}

export const createEetReversalId = (refundId: RefundId): EetReversalId =>
  createIdFromString<"EetReversal">(`eetReversal:${refundId}`)

export const createEetCertificateId = (
  certificateDer: EetBase64
): EetCertificateId =>
  createIdFromString<"EetCertificate">(`eetCertificate:${certificateDer}`)

const EET_MAX_AMOUNT_MINOR_UNITS = 9_999_999_999

const EET_OVERDUE_AFTER_HOURS = 48

const EET_CERTIFICATE_EXPIRY_WARNING_DAYS = 21

export const EET_PRIORITY_PERIOD_MS = 10 * 60 * 1000

const EET_FIRST_SENDING_PERIOD_MS = 5 * 60 * 1000

export const toEetCashRegisterId = (deviceId: DeviceId): EetCashRegisterId =>
  EetCashRegisterIdSchema.decode(deviceId.slice(0, 20))

export const formatEetDateTime = (date: Date): EetDateTime =>
  EetDateTimeSchema.decode(format(date, "yyyy-MM-dd'T'HH:mm:ssXXX"))

export const parseEetDateTime = (value: EetDateTime): TimestampMs =>
  TimestampMs(parseISO(value).getTime())

export const getEetReversalStartsAt = ({
  refundedAt,
  saleConfirmedAt,
}: {
  readonly refundedAt: TimestampMs
  readonly saleConfirmedAt: EetDateTime
}): TimestampMs =>
  TimestampMs(Math.max(refundedAt, parseEetDateTime(saleConfirmedAt)))

export interface EetExtraClaim extends ClaimedAmount {
  readonly claimId: ReconciliationClaimId
  readonly claimedAt: TimestampMs
  readonly deviceId: DeviceId | null
  readonly method: AccountKind
}

export interface EetExtraSaleDue {
  readonly extraFrom: NonNegativeInteger
  readonly amount: NonNegativeInteger
  readonly claim: EetExtraClaim
}

export const calculateEetSettlementValue = ({
  settlement,
  amount,
}: {
  readonly settlement: ClaimedAmount
  readonly amount: NonNegativeInteger
}): NonNegativeInteger =>
  NonNegativeInteger(Math.min(amount, toPaymentCurrencyAmount(settlement)))

export const deriveDueEetExtraSale = ({
  claims,
  amount,
  tipAmount,
  tipOwner,
  saleSettlementIds,
  enabledAt,
  reportedExtra,
}: {
  readonly claims: ReadonlyArray<EetExtraClaim>
  readonly amount: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly tipOwner: EetTipOwner | null
  readonly saleSettlementIds: ReadonlyArray<AccountTransactionId | null>
  readonly enabledAt: TimestampMs
  readonly reportedExtra: NonNegativeInteger
}): EetExtraSaleDue | null => {
  const ordered = claims.toSorted(
    (left, right) =>
      left.claimedAt - right.claimedAt ||
      left.claimId.localeCompare(right.claimId)
  )
  const firstClaim = ordered.at(0)
  const latestClaim = ordered.at(-1)
  if (firstClaim === undefined || latestClaim === undefined) return null

  const settlements = [
    ...new Map(
      ordered.map((claim) => [claim.accountTransactionId, claim])
    ).values(),
  ]
  const reportedIds =
    saleSettlementIds.length === 0
      ? [firstClaim.accountTransactionId]
      : saleSettlementIds
  const hasOwnSale = ({ accountTransactionId }: EetExtraClaim) =>
    reportedIds.includes(accountTransactionId)
  const salesWithoutClaim = reportedIds.filter(
    (id) =>
      !settlements.some(
        ({ accountTransactionId }) => accountTransactionId === id
      )
  ).length
  const saleValue = [
    ...settlements.filter(hasOwnSale),
    ...settlements
      .filter((settlement) => !hasOwnSale(settlement))
      .slice(0, salesWithoutClaim),
  ].reduce(
    (sum, settlement) =>
      sum + calculateEetSettlementValue({ settlement, amount }),
    0
  )
  const employeesTip = tipOwner === "employees" ? tipAmount : 0
  const extraOf = (counted: ReadonlyArray<EetExtraClaim>) =>
    Math.max(
      0,
      sumDistinctClaimedAmounts(counted) - Math.max(saleValue, employeesTip)
    )
  const extraFrom = NonNegativeInteger(
    Math.max(
      reportedExtra,
      extraOf(ordered.filter(({ claimedAt }) => claimedAt < enabledAt))
    )
  )
  const extra = extraOf(ordered)
  if (extra <= extraFrom) return null

  return {
    extraFrom,
    amount: NonNegativeInteger(extra - extraFrom),
    claim: latestClaim,
  }
}

interface EetAttempts {
  readonly attemptStartedAt: TimestampMs | null
  readonly lastAttemptAt: TimestampMs | null
}

export const hasEetAttempt = ({
  attemptStartedAt,
  lastAttemptAt,
}: EetAttempts): boolean => attemptStartedAt !== null || lastAttemptAt !== null

export const hasLostEetAnswer = ({
  attemptStartedAt,
  lastAttemptAt,
}: EetAttempts): boolean =>
  attemptStartedAt !== null &&
  (lastAttemptAt === null || attemptStartedAt > lastAttemptAt)

export const isEetFirstSending = ({
  attempts,
  recordingDeviceId,
  deviceId,
  startsAt,
  now,
}: {
  readonly attempts: EetAttempts
  readonly recordingDeviceId: DeviceId
  readonly deviceId: DeviceId
  readonly startsAt: TimestampMs
  readonly now: Date
}): boolean =>
  !hasEetAttempt(attempts) &&
  recordingDeviceId === deviceId &&
  now.getTime() <= startsAt + EET_FIRST_SENDING_PERIOD_MS

export const getEetPriorityEndsAt = (startsAt: TimestampMs): TimestampMs =>
  TimestampMs(startsAt + EET_PRIORITY_PERIOD_MS)

export const getEetRecordingDeviceWaitEndsAt = ({
  attempts,
  recordingDeviceId,
  deviceId,
  startsAt,
  now,
}: {
  readonly attempts: EetAttempts
  readonly recordingDeviceId: DeviceId
  readonly deviceId: DeviceId
  readonly startsAt: TimestampMs
  readonly now: Date
}): TimestampMs | null => {
  const endsAt = getEetPriorityEndsAt(startsAt)
  return recordingDeviceId === deviceId ||
    hasEetAttempt(attempts) ||
    now.getTime() >= endsAt
    ? null
    : endsAt
}

export const bytesToEetBase64 = (bytes: Uint8Array): EetBase64 =>
  EetBase64Schema.decode(btoa(String.fromCharCode(...bytes)))

export const eetBase64ToBytes = (value: EetBase64): Uint8Array =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

export const getEetUnsupportedReason = ({
  amount,
  currency,
}: {
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
}): EetUnsupportedReason | null => {
  if (currency !== "CZK") return "currency"
  if (amount > EET_MAX_AMOUNT_MINOR_UNITS) return "amount"
  return null
}

export const resolveEetEnvironment = ({
  environment,
  isTestCertificate,
  isProductionAvailable,
}: {
  readonly environment: EetEnvironment | null
  readonly isTestCertificate: boolean
  readonly isProductionAvailable: boolean
}): EetEnvironment => {
  if (!isProductionAvailable || isTestCertificate) return "playground"
  return environment ?? "production"
}

export const deriveEetSaleStatus = ({
  confirmation,
  environment,
  unsupportedReason,
  lastAttemptResult,
}: {
  readonly confirmation: { readonly isTest: boolean } | null
  readonly environment: EetEnvironment
  readonly unsupportedReason: EetUnsupportedReason | null
  readonly lastAttemptResult: EetAttemptResult | null
}): EetSaleStatus => {
  if (confirmation !== null) {
    return confirmation.isTest || environment === "playground"
      ? "testConfirmed"
      : "confirmed"
  }
  if (unsupportedReason !== null) return "unsupported"
  if (lastAttemptResult === "rejected") return "rejected"
  return "pending"
}

export const getEetSaleOverdueAt = (saleAt: EetDateTime): TimestampMs =>
  TimestampMs(addHours(parseISO(saleAt), EET_OVERDUE_AFTER_HOURS).getTime())

export const isEetSaleOverdue = ({
  status,
  saleAt,
  now,
}: {
  readonly status: EetSaleStatus
  readonly saleAt: EetDateTime
  readonly now: Date
}): boolean =>
  (status === "pending" || status === "rejected") &&
  now.getTime() > getEetSaleOverdueAt(saleAt)

export const isEetSandboxActive = ({
  enabledAt,
  environment,
}: {
  readonly enabledAt: TimestampMs | null
  readonly environment: EetEnvironment
}): boolean => enabledAt !== null && environment === "playground"

export const deriveEetCertificateExpiry = ({
  validTo,
  now,
}: {
  readonly validTo: Date
  readonly now: Date
}): EetCertificateExpiry => {
  if (now >= validTo) return "expired"
  if (addDays(now, EET_CERTIFICATE_EXPIRY_WARNING_DAYS) > validTo) {
    return "expiresSoon"
  }
  return "valid"
}

export const findEetConfigurationGaps = ({
  validTo,
  establishmentId,
  now,
}: {
  readonly validTo: TimestampMs | null
  readonly establishmentId: EetEstablishmentId | null
  readonly now: Date
}): ReadonlyArray<EetConfigurationGap> => {
  const gaps: EetConfigurationGap[] = []
  if (validTo === null) {
    gaps.push("certificate")
  } else if (
    deriveEetCertificateExpiry({ validTo: new Date(validTo), now }) ===
    "expired"
  ) {
    gaps.push("certificateExpired")
  }
  if (establishmentId === null) gaps.push("establishment")
  return gaps
}

/** `eetSale.warningsJson` as stored. */
export const EetWarningsJson = jsonCodec(z.array(EetWarningSchema).readonly())

export const parseEetWarnings = (json: string): ReadonlyArray<EetWarning> => {
  const parsed = z.safeDecode(EetWarningsJson, json)
  return parsed.success ? parsed.data : []
}
