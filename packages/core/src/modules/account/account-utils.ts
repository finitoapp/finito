import { createIdFromString, type InferRow, type OwnerId } from "@evolu/common"
import type { SparkSecret } from "../shared/key-derivation.ts"
import type { FiatCurrency, Iban } from "../shared/schema.ts"
import type { enabledPaymentMethodAccountsQuery } from "./account-queries.ts"
import type { AccountId, AccountKind } from "./account-types.ts"

/** What `derivePaymentMethodsOffered` reads of an account turned on. */
export type PaymentMethodAccount = Pick<
  InferRow<typeof enabledPaymentMethodAccountsQuery>,
  | "kind"
  | "sparkSecret"
  | "iban"
  | "ibanCurrency"
  | "cashRegisterCurrency"
  | "cardCurrency"
  | "qerkoTerminalCurrency"
  | "qerkoPaymentCurrency"
  | "lightningAddress"
>

/**
 * An account's id is derived from the detail values that identify it, so the
 * same bank account, wallet or till always lands on the same row — two
 * devices configuring it offline write one row instead of racing on a shared
 * one. Those values are therefore immutable: changing one means a different
 * account (a new row), never an edit. Everything else on the account and its
 * detail row stays editable.
 */
export const createIbanAccountId = ({
  iban,
  currency,
}: {
  readonly iban: Iban
  readonly currency: FiatCurrency
}): AccountId =>
  createIdFromString<"Account">(`account:iban:${iban}:${currency}`)

export const createSparkAccountId = (secret: SparkSecret): AccountId =>
  createIdFromString<"Account">(`account:spark:${secret}`)

export const createCashRegisterAccountId = (
  currency: FiatCurrency
): AccountId =>
  createIdFromString<"Account">(`account:cashRegister:${currency}`)

export const createCardSwitchioAccountId = (
  currency: FiatCurrency
): AccountId =>
  createIdFromString<"Account">(`account:cardSwitchio:${currency}`)

export const createQerkoTerminalAccountId = (
  currency: FiatCurrency
): AccountId =>
  createIdFromString<"Account">(`account:qerkoTerminal:${currency}`)

export const createQerkoPaymentAccountId = (
  currency: FiatCurrency
): AccountId =>
  createIdFromString<"Account">(`account:qerkoPayment:${currency}`)

/** Derived from Linky's app owner: one Cashu account per shared wallet. */
export const createCashuAccountId = (linkyAppOwnerId: OwnerId): AccountId =>
  createIdFromString<"Account">(`account:cashu:${linkyAppOwnerId}`)

/**
 * Derived from the lowercased address, so a different address is a different
 * account and past transactions keep the one their money went to
 * (lightning-address/0006).
 */
export const createLightningAddressAccountId = (address: string): AccountId =>
  createIdFromString<"Account">(
    `account:lightningAddress:${address.toLowerCase()}`
  )

/**
 * The fixed id the fiat bank account had before ids were derived from its
 * IBAN and currency. `fioPluginFixedIdMigration` matches the legacy plugin rows
 * that still point at it, and the Fio plugin is saved against it while no
 * fiat bank account exists yet — `saveFiatBankAccount` re-points the plugin
 * once one does, and `accountDerivedIdMigration` once a legacy one is migrated.
 */
export const legacyFiatBankAccountId = createIdFromString<"Account">(
  "payky-fiat-bank-account"
)

export const normalizeMnemonic = (value: string): string =>
  value.replaceAll(/\s+/gu, " ").trim()

/**
 * The payment methods a payment in `currency` offers, from the accounts
 * turned on (`enabledPaymentMethodAccountsQuery`): an account of each kind
 * set up enough to take money, and in the payment's own currency where the
 * kind has one — the same accounts the payment screen offers a tab for.
 *
 * Two methods also need what the screen checks before it shows their tab,
 * or a payment only they could take would be created where nothing on screen
 * can settle it (payment/0017): the card terminal needs `cardTerminalLinked`,
 * true only where the device can drive it (the native app), and Qerko
 * payments need `qerkoRestaurantPaired`, the restaurant their QR code names.
 */
export const derivePaymentMethodsOffered = ({
  accounts,
  currency,
  cardTerminalLinked,
  qerkoRestaurantPaired,
}: {
  readonly accounts: ReadonlyArray<PaymentMethodAccount>
  readonly currency: FiatCurrency
  readonly cardTerminalLinked: boolean
  readonly qerkoRestaurantPaired: boolean
}): ReadonlyArray<AccountKind> => {
  const offered = {
    spark: (account) => account.sparkSecret !== null,
    iban: (account) =>
      account.iban !== null && account.ibanCurrency === currency,
    cashRegister: (account) => account.cashRegisterCurrency === currency,
    cardSwitchio: (account) =>
      cardTerminalLinked && account.cardCurrency === currency,
    qerkoTerminal: (account) => account.qerkoTerminalCurrency === currency,
    qerkoPayment: (account) =>
      qerkoRestaurantPaired && account.qerkoPaymentCurrency === currency,
    // Neither is tied to a currency: both are quoted in sats.
    cashu: () => true,
    lightningAddress: (account) => account.lightningAddress !== null,
  } satisfies Record<AccountKind, (account: PaymentMethodAccount) => boolean>

  return [
    ...new Set(
      accounts
        .filter((account) => offered[account.kind](account))
        .map((account) => account.kind)
    ),
  ]
}
