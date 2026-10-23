import { id } from "@evolu/common"
import { standardSchemaToZod } from "../../zod-utils.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type {
  ConstantSymbol,
  FiatCurrency,
  Integer,
  NonEmptyString,
  NonEmptyString255,
  SpecificSymbol,
  SyncSource,
  TimestampMs,
  VariableSymbol,
} from "../shared/schema.ts"

export const ReconciliationClaimIdRaw = id("ReconciliationClaim")
export const ReconciliationClaimId = standardSchemaToZod(
  ReconciliationClaimIdRaw
)
export type ReconciliationClaimId = typeof ReconciliationClaimIdRaw.Output

/** A claim row as the actions write it. */
export interface ReconciliationClaimWrite {
  readonly id: ReconciliationClaimId
  readonly deviceId: DeviceId | null
  readonly paymentId: PaymentId
  readonly accountTransactionId: AccountTransactionId
  readonly source: SyncSource
  readonly claimedAt: TimestampMs
}

/**
 * One line of a bank statement as the bank syncs (Fio, MONETA) hand it over:
 * already normalized from the bank's own shape, keyed by the bank's reference.
 */
export interface BankTransaction {
  readonly bankReference: NonEmptyString255
  /** Signed minor units: negative for money leaving the account. */
  readonly amount: Integer
  readonly currency: FiatCurrency
  readonly occurredAt: TimestampMs
  readonly note: NonEmptyString | null
  readonly recipientMessage: NonEmptyString | null
  readonly variableSymbol: VariableSymbol | null
  readonly constantSymbol: ConstantSymbol | null
  readonly specificSymbol: SpecificSymbol | null
}

export interface RecordedBankTransaction {
  readonly accountTransactionId: AccountTransactionId
  readonly isClaimed: boolean
}

export interface RecordedBankTransactions {
  readonly recordedCount: number
  /** Payments the new transactions pay. */
  readonly claimedPaymentIds: ReadonlyArray<PaymentId>
}
