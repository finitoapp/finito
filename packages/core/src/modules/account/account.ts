import type { IndexesConfig } from "@evolu/common/local-first"
import { CashuPaymentRequestLegsSchema } from "../../cashu/cashu-payment-request.ts"
import { DeviceId } from "../device/device-types.ts"
import { SparkSecretSchema } from "../shared/key-derivation.ts"
import {
  FiatCurrencySchema,
  IbanSchema,
  type InferTable,
  NonEmptyString255Schema,
  TimestampMsSchema,
} from "../shared/schema.ts"
import {
  AccountId,
  AccountKindSchema,
  BankQrFormatSchema,
} from "./account-types.ts"

export const account = {
  id: AccountId,
  deviceId: DeviceId.nullable(),
  name: NonEmptyString255Schema,
  kind: AccountKindSchema,
} as const

export const accountIban = {
  id: AccountId,
  iban: IbanSchema,
  currency: FiatCurrencySchema,
  defaultQrFormat: BankQrFormatSchema,
} as const

export const accountSpark = {
  id: AccountId,
  secret: SparkSecretSchema,
} as const

/**
 * High-water mark for the Spark sync job's periodic full history rescan —
 * mirrors `fioPluginSyncPointer`. `lastSyncedAt` is the wall-clock time the
 * last successful rescan *started* (not the newest transfer's own
 * `createdTime`/`updatedTime`), the same way FIO's pointer is the sync
 * period's `to`, not a fact derived from the transactions found: an account
 * with no new transfers must still advance the pointer forward with the
 * clock, and a transfer's own timestamp says nothing about how safe skipping
 * it is next time.
 */
export const sparkAccountSyncPointer = {
  id: AccountId,
  lastSyncedAt: TimestampMsSchema,
} as const

export const accountCashRegister = {
  id: AccountId,
  currency: FiatCurrencySchema,
} as const

/**
 * The card terminal the SwitchioPay app is paired with. Owns nothing but a
 * currency: everything else about the terminal (merchant id, acquirer,
 * batches) lives in SwitchioPay itself, which this app only drives through
 * intents. See `src/core/native/switchio.ts`.
 */
export const accountCardSwitchio = {
  id: AccountId,
  currency: FiatCurrencySchema,
} as const

/**
 * The card terminal Qerko drives remotely (qerko/0001). Owns nothing but a
 * currency: the API key is the `qerkoPlugin`, the terminal a device picks is
 * in the device database, and everything about the terminal itself stays at
 * Qerko.
 */
export const accountQerkoTerminal = {
  id: AccountId,
  currency: FiatCurrencySchema,
} as const

/**
 * The Cashu payment method (cashu.md §4). It has no secret: the wallet is the
 * one Linky shows, derived from the master key, and its mint is Linky's
 * synced default mint, read when a payment is prepared.
 */
export const accountCashu = {
  id: AccountId,
  /**
   * What the payment QR carries, both legs unless narrowed (settings/0003);
   * `null` means both. Nullable, so rows written before the column existed
   * keep their default.
   */
  paymentRequestLegs: CashuPaymentRequestLegsSchema.nullable(),
} as const

/**
 * The merchant's own Lightning wallet, reached through its Lightning address
 * (lightning-address/0001). Payky holds no keys and no balance: every payment
 * asks the address for an invoice and watches its LUD-21 `verify` URL. The
 * address is lowercased and derives the id (lightning-address/0006).
 */
export const accountLightningAddress = {
  id: AccountId,
  address: NonEmptyString255Schema,
} as const

export const accountIndexes = ((create) => [
  create("account_kind").on("account").column("kind"),
]) satisfies IndexesConfig

export type AccountRow = InferTable<typeof account>
export type AccountIbanRow = InferTable<typeof accountIban>
export type AccountSparkRow = InferTable<typeof accountSpark>
export type SparkAccountSyncPointerRow = InferTable<
  typeof sparkAccountSyncPointer
>
export type AccountCashRegisterRow = InferTable<typeof accountCashRegister>
export type AccountCardSwitchioRow = InferTable<typeof accountCardSwitchio>
export type AccountQerkoTerminalRow = InferTable<typeof accountQerkoTerminal>
export type AccountCashuRow = InferTable<typeof accountCashu>
export type AccountLightningAddressRow = InferTable<
  typeof accountLightningAddress
>
