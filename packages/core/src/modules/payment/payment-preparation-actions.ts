import {
  err,
  type InsertValues,
  ok,
  sqliteTrue,
  type Task,
  type UpsertValues,
} from "@evolu/common"
import { loadCashuDefaultMint } from "../../cashu/cashu-mints.ts"
import {
  type CashuTopupDeps,
  createCashuTopupQuote,
} from "../../cashu/cashu-topup.ts"
import type { MintFailure } from "../../cashu/cashu-wallet.ts"
import type {
  DateDep,
  EvoluOwnerDep,
  FetchDep,
  FetchError,
} from "../../deps.ts"
import {
  createLightningAddressVerifyUnsupportedError,
  fetchLnurlPayInvoice,
  fetchLnurlPayMetadata,
} from "../../integrations/lnurl/lnurl-pay-client.ts"
import {
  fetchYadioBtcExchangeRate,
  type YadioApiDep,
  type YadioApiError,
  type YadioHttpError,
} from "../../integrations/yadio/yadio-client.ts"
import type { SparkWalletDep } from "../../spark/spark-wallet.ts"
import {
  activeCashuAccountByIdQuery,
  cardSwitchioAccountByIdQuery,
  cashRegisterAccountByIdQuery,
  ibanAccountByIdQuery,
  lightningAddressAccountByIdQuery,
  qerkoPaymentAccountByIdQuery,
  qerkoTerminalAccountByIdQuery,
} from "../account/account-queries.ts"
import { activeSparkAccountByIdQuery } from "../account/account-spark-queries.ts"
import type { AccountId } from "../account/account-types.ts"
import { CashuAmount } from "../cashu/cashu-types.ts"
import { paymentNumberByPaymentIdQuery } from "../payment-number/payment-number-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import type { SparkSecret } from "../shared/key-derivation.ts"
import { fiatMinorUnitsToSats } from "../shared/money.ts"
import { getFirstOr } from "../shared/result.ts"
import {
  type FiatCurrency,
  type NonEmptyString,
  NonEmptyStringSchema,
  type NonNegativeInteger,
  NonNegativeIntegerSchema,
  type PositiveNumber,
  PositiveNumberSchema,
  type TimestampMs,
  TimestampMsSchema,
} from "../shared/schema.ts"
import type {
  payment,
  paymentBtc,
  paymentCardSwitchio,
  paymentCashRegister,
  paymentIban,
  paymentLightningAddress,
  paymentQerkoPayment,
  paymentQerkoTerminal,
} from "./payment.ts"
import { createPayment, loadPayment } from "./payment-actions.ts"
import {
  type AccountCurrencyMismatchError,
  type AccountSparkNotFoundError,
  type CardSwitchioAccountNotFoundError,
  type CashRegisterAccountNotFoundError,
  type CashuAccountNotFoundError,
  type CashuWalletNotSyncedError,
  type CreatePreparedPaymentError,
  createAccountSparkNotFoundError,
  createCardSwitchioAccountNotFoundError,
  createCashRegisterAccountNotFoundError,
  createCashuAccountNotFoundError,
  createCashuWalletNotSyncedError,
  createIbanAccountNotFoundError,
  createLightningAddressAccountNotFoundError,
  createLightningAddressAmountOutOfRangeError,
  createPaymentNumberNotFoundError,
  createPaymentPreparationFailedError,
  createQerkoPaymentAccountNotFoundError,
  createQerkoTerminalAccountNotFoundError,
  createZeroAmountNotPayableError,
  type IbanAccountNotFoundError,
  type PaymentNotFoundError,
  type PaymentNumberNotFoundError,
  type PaymentPreparationFailedError,
  type PrepareLightningAddressMethodError,
  type PreparePaymentMethodError,
  type QerkoPaymentAccountNotFoundError,
  type QerkoTerminalAccountNotFoundError,
  type ZeroAmountNotPayableError,
} from "./payment-errors.ts"
import { loadAccountWithCurrencyCheck } from "./payment-guards.ts"
import { paymentNonExpiringMethodsByIdQuery } from "./payment-queries.ts"
import {
  type PaymentBtcInput,
  upsertPaymentSparkDetails,
} from "./payment-row-actions.ts"
import {
  computePaymentExpiresAt,
  DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS,
} from "./payment-status-utils.ts"
import {
  createSpecificSymbolFromDate,
  createVariableSymbolFromSerialNumber,
} from "./payment-symbol-utils.ts"
import type { PaymentId } from "./payment-types.ts"

const optionalNonEmptyString = (
  value: string | null | undefined
): NonEmptyString | undefined =>
  value === null || value === undefined || value === ""
    ? undefined
    : NonEmptyStringSchema.decode(value)

interface SatsQuote {
  readonly amountSats: NonNegativeInteger
  readonly exchangeRate: PositiveNumber
  readonly exchangeRateSource: "yadio"
  readonly exchangeRateFetchedAt: TimestampMs
}

/**
 * The fiat amount in sats at Yadio's rate, shared by every method that asks
 * for a Lightning invoice.
 */
const quoteFiatAmountInSats =
  ({
    currency,
    amount,
  }: {
    readonly currency: FiatCurrency
    readonly amount: number
  }): Task<
    SatsQuote,
    ZeroAmountNotPayableError | YadioHttpError | YadioApiError | FetchError,
    FetchDep & YadioApiDep
  > =>
  async (run) => {
    // A zero-sat Lightning invoice is an *amountless* invoice: the payer
    // chooses what to send. Handing one out from a terminal displaying a zero
    // charge would take whatever arrived and claim it against a payment worth
    // nothing, so refuse before the quote is even fetched. The keypad does
    // let "0" through — it only checks that the amount parses — which is how
    // this is reachable at all.
    if (amount <= 0) return err(createZeroAmountNotPayableError({ amount }))

    const quote = await run(fetchYadioBtcExchangeRate(currency))
    if (!quote.ok) return quote

    return ok({
      amountSats: NonNegativeIntegerSchema.decode(
        fiatMinorUnitsToSats({
          amount,
          currency,
          exchangeRate: quote.value.exchangeRate,
        })
      ),
      exchangeRate: PositiveNumberSchema.decode(quote.value.exchangeRate),
      exchangeRateSource: "yadio",
      exchangeRateFetchedAt: TimestampMsSchema.decode(quote.value.fetchedAt),
    })
  }

/**
 * Quotes the fiat amount in sats, creates a Spark Lightning invoice, and
 * shapes the result into the `paymentBtc`/`paymentBtcLightning`/
 * `paymentBtcSpark` payload shared by `createPreparedPayment` and
 * `preparePaymentMethod`. Does not write anything.
 */
const createSparkLightningInvoice =
  ({
    accountId,
    secret,
    currency,
    amount,
    memo,
    expirySeconds,
    includeSparkInvoice,
  }: {
    readonly accountId: AccountId
    readonly secret: SparkSecret
    readonly currency: FiatCurrency
    readonly amount: number
    readonly memo?: string
    /**
     * Required, not optional: the SDK applies a default of its own when this
     * is omitted, and the invoice then expires at a time nothing in this app
     * knows — leaving `payment.expiresAt` either null or stale, so
     * `derivePaymentStatus` never learns the invoice died and the bill's
     * editing lock never releases. Callers resolve
     * `DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS` so the stored expiry and the
     * invoice's own always come from the same number.
     */
    readonly expirySeconds: number
    readonly includeSparkInvoice?: boolean
  }): Task<
    PaymentBtcInput,
    | ZeroAmountNotPayableError
    | PaymentPreparationFailedError
    | YadioHttpError
    | YadioApiError
    | FetchError,
    EvoluDep & SparkWalletDep & FetchDep & YadioApiDep
  > =>
  async (run) => {
    const quote = await run(quoteFiatAmountInSats({ currency, amount }))
    if (!quote.ok) return quote
    const { amountSats } = quote.value

    try {
      await using wallet = await run.deps.sparkWallet.create(secret)
      const lightningInvoice = await wallet.createLightningInvoice(
        removeUndefinedValues({
          amountSats,
          memo,
          expirySeconds,
          includeSparkInvoice: includeSparkInvoice ?? true,
        })
      )
      // A `paymentBtcSpark` row only exists when the SDK actually returned an
      // invoice — `includeSparkInvoice` is a request, not a guarantee.
      const sparkInvoice = optionalNonEmptyString(lightningInvoice.sparkInvoice)

      return ok({
        accountId,
        ...quote.value,
        lightning: {
          lnInvoice: NonEmptyStringSchema.decode(
            lightningInvoice.invoice.encodedInvoice
          ),
          ...removeUndefinedValues({
            lightningReceiveRequestId: optionalNonEmptyString(
              lightningInvoice.id
            ),
            paymentHash: optionalNonEmptyString(
              lightningInvoice.invoice.paymentHash
            ),
            paymentPreimage: optionalNonEmptyString(
              lightningInvoice.paymentPreimage
            ),
          }),
        },
        sparkInvoice: sparkInvoice === undefined ? undefined : { sparkInvoice },
      })
    } catch (error) {
      return err(
        createPaymentPreparationFailedError({
          message:
            error instanceof Error
              ? error.message
              : "Failed to prepare payment details",
        })
      )
    }
  }

export const createPreparedPayment =
  ({
    spark,
    ...input
  }: Omit<InsertValues<typeof payment>, "expiresAt"> & {
    readonly cashRegister?: Omit<InsertValues<typeof paymentCashRegister>, "id">
    readonly spark?: Omit<
      InsertValues<typeof paymentBtc>,
      | "id"
      | "amountSats"
      | "exchangeRate"
      | "exchangeRateSource"
      | "exchangeRateFetchedAt"
    > & {
      readonly memo?: string
      readonly expirySeconds?: number
      readonly includeSparkInvoice?: boolean
    }
    readonly iban?: Omit<InsertValues<typeof paymentIban>, "id">
  }): Task<
    PaymentId,
    CreatePreparedPaymentError,
    EvoluDep & EvoluOwnerDep & DateDep & SparkWalletDep & FetchDep & YadioApiDep
  > =>
  async (run) => {
    if (!spark) {
      return run(createPayment({ ...input, expiresAt: null }))
    }

    const [sparkAccount] = await run.deps.evolu.loadQuery(
      activeSparkAccountByIdQuery(spark.accountId)
    )
    if (!sparkAccount) {
      return err(createAccountSparkNotFoundError({ id: spark.accountId }))
    }

    const expirySeconds =
      spark.expirySeconds ?? DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS
    const sparkPaymentResult = await run(
      createSparkLightningInvoice({
        accountId: spark.accountId,
        secret: sparkAccount.secret,
        currency: input.currency,
        amount: input.amount,
        memo: spark.memo,
        expirySeconds,
        includeSparkInvoice: spark.includeSparkInvoice,
      })
    )
    if (!sparkPaymentResult.ok) return sparkPaymentResult

    return run(
      createPayment({
        ...input,
        expiresAt: computePaymentExpiresAt(run.deps.date.now(), expirySeconds),
        spark: sparkPaymentResult.value,
      })
    )
  }

/**
 * Resolves one requested payment method into the row it should write, or the
 * reason it cannot. Each is its own Task so `preparePaymentMethod` composes
 * them with the ordinary `await run(...)` shape instead of inline async IIFEs
 * whose `Result`s it then has to unwrap by hand.
 */
const prepareCashRegisterMethod =
  ({
    paymentId,
    accountId,
    paymentCurrency,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly paymentCurrency: FiatCurrency
  }): Task<
    UpsertValues<typeof paymentCashRegister>,
    CashRegisterAccountNotFoundError | AccountCurrencyMismatchError,
    EvoluDep
  > =>
  async (run) => {
    const accountResult = loadAccountWithCurrencyCheck({
      rows: await run.deps.evolu.loadQuery(
        cashRegisterAccountByIdQuery(accountId)
      ),
      notFoundError: createCashRegisterAccountNotFoundError({ id: accountId }),
      accountKind: "cashRegister",
      accountId,
      expectedCurrency: paymentCurrency,
    })
    if (!accountResult.ok) return accountResult

    return ok({ id: paymentId, accountId })
  }

const prepareQerkoTerminalMethod =
  ({
    paymentId,
    accountId,
    paymentCurrency,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly paymentCurrency: FiatCurrency
  }): Task<
    UpsertValues<typeof paymentQerkoTerminal>,
    QerkoTerminalAccountNotFoundError | AccountCurrencyMismatchError,
    EvoluDep
  > =>
  async (run) => {
    const accountResult = loadAccountWithCurrencyCheck({
      rows: await run.deps.evolu.loadQuery(
        qerkoTerminalAccountByIdQuery(accountId)
      ),
      notFoundError: createQerkoTerminalAccountNotFoundError({
        id: accountId,
      }),
      accountKind: "qerkoTerminal",
      accountId,
      expectedCurrency: paymentCurrency,
    })
    if (!accountResult.ok) return accountResult

    // Only the account: the attempt markers are written by the attempt, and
    // preparing the method again must not erase an unresolved one.
    return ok({ id: paymentId, accountId })
  }

const prepareQerkoPaymentMethod =
  ({
    paymentId,
    accountId,
    paymentCurrency,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly paymentCurrency: FiatCurrency
  }): Task<
    UpsertValues<typeof paymentQerkoPayment>,
    QerkoPaymentAccountNotFoundError | AccountCurrencyMismatchError,
    EvoluDep
  > =>
  async (run) => {
    const accountResult = loadAccountWithCurrencyCheck({
      rows: await run.deps.evolu.loadQuery(
        qerkoPaymentAccountByIdQuery(accountId)
      ),
      notFoundError: createQerkoPaymentAccountNotFoundError({
        id: accountId,
      }),
      accountKind: "qerkoPayment",
      accountId,
      expectedCurrency: paymentCurrency,
    })
    if (!accountResult.ok) return accountResult

    // The QR code is built in the UI from the pairing's restaurant and the
    // payment's id, as the bank QR is, so the row needs nothing else.
    return ok({ id: paymentId, accountId })
  }

const prepareCardMethod =
  ({
    paymentId,
    accountId,
    paymentCurrency,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly paymentCurrency: FiatCurrency
  }): Task<
    UpsertValues<typeof paymentCardSwitchio>,
    CardSwitchioAccountNotFoundError | AccountCurrencyMismatchError,
    EvoluDep
  > =>
  async (run) => {
    const accountResult = loadAccountWithCurrencyCheck({
      rows: await run.deps.evolu.loadQuery(
        cardSwitchioAccountByIdQuery(accountId)
      ),
      notFoundError: createCardSwitchioAccountNotFoundError({
        id: accountId,
      }),
      accountKind: "cardSwitchio",
      accountId,
      expectedCurrency: paymentCurrency,
    })
    if (!accountResult.ok) return accountResult

    return ok({ id: paymentId, accountId })
  }

/**
 * Unlike the other methods, a bank transfer needs the payment's number: its
 * serial and date become the variable and specific symbols the payer quotes.
 */
const prepareIbanMethod =
  ({
    paymentId,
    accountId,
    paymentCurrency,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly paymentCurrency: FiatCurrency
  }): Task<
    UpsertValues<typeof paymentIban>,
    | IbanAccountNotFoundError
    | AccountCurrencyMismatchError
    | PaymentNumberNotFoundError,
    EvoluDep
  > =>
  async (run) => {
    const accountResult = loadAccountWithCurrencyCheck({
      rows: await run.deps.evolu.loadQuery(ibanAccountByIdQuery(accountId)),
      notFoundError: createIbanAccountNotFoundError({ id: accountId }),
      accountKind: "iban",
      accountId,
      expectedCurrency: paymentCurrency,
    })
    if (!accountResult.ok) return accountResult

    const paymentNumberResult = getFirstOr(
      await run.deps.evolu.loadQuery(paymentNumberByPaymentIdQuery(paymentId)),
      createPaymentNumberNotFoundError({ paymentId })
    )
    if (!paymentNumberResult.ok) return paymentNumberResult

    const paymentNumber = paymentNumberResult.value

    return ok(
      removeUndefinedValues({
        id: paymentId,
        accountId,
        variableSymbol: createVariableSymbolFromSerialNumber(
          paymentNumber.serialNumber
        ),
        specificSymbol: createSpecificSymbolFromDate(paymentNumber.date),
      })
    )
  }

const prepareSparkMethod =
  ({
    paymentId,
    paymentCurrency,
    amount,
    spark,
  }: {
    readonly paymentId: PaymentId
    readonly paymentCurrency: FiatCurrency
    readonly amount: number
    readonly spark: {
      readonly accountId: AccountId
      readonly memo?: string
      readonly expirySeconds?: number
      readonly includeSparkInvoice?: boolean
    }
  }): Task<
    {
      readonly id: PaymentId
      readonly expirySeconds: number
    } & PaymentBtcInput,
    | AccountSparkNotFoundError
    | ZeroAmountNotPayableError
    | PaymentPreparationFailedError
    | YadioHttpError
    | YadioApiError
    | FetchError,
    EvoluDep & SparkWalletDep & FetchDep & YadioApiDep
  > =>
  async (run) => {
    const [sparkAccount] = await run.deps.evolu.loadQuery(
      activeSparkAccountByIdQuery(spark.accountId)
    )
    if (!sparkAccount)
      return err(createAccountSparkNotFoundError({ id: spark.accountId }))

    const expirySeconds =
      spark.expirySeconds ?? DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS
    const sparkInvoiceResult = await run(
      createSparkLightningInvoice({
        accountId: spark.accountId,
        secret: sparkAccount.secret,
        currency: paymentCurrency,
        amount,
        memo: spark.memo,
        expirySeconds,
        includeSparkInvoice: spark.includeSparkInvoice,
      })
    )
    if (!sparkInvoiceResult.ok) return sparkInvoiceResult

    // Returned so the caller stores the window this invoice was actually
    // made with, rather than whatever it happened to pass in.
    return ok({ id: paymentId, expirySeconds, ...sparkInvoiceResult.value })
  }

/**
 * Asks the merchant's own wallet for an invoice through its Lightning address
 * (lightning-address/0001): the sats amount from Yadio, within the wallet's
 * min/maxSendable, the payment's number as a LUD-12 comment where the wallet
 * takes one. An invoice without a LUD-21 `verify` URL Payky could poll, or
 * without a payment hash to check a preimage against, is refused
 * (lightning-address/0003).
 */
const prepareLightningAddressMethod =
  ({
    paymentId,
    paymentCurrency,
    amount,
    accountId,
  }: {
    readonly paymentId: PaymentId
    readonly paymentCurrency: FiatCurrency
    readonly amount: number
    readonly accountId: AccountId
  }): Task<
    UpsertValues<typeof paymentLightningAddress> & {
      readonly invoiceExpiresAt: TimestampMs
    },
    | PrepareLightningAddressMethodError
    | ZeroAmountNotPayableError
    | YadioHttpError
    | YadioApiError,
    EvoluDep & FetchDep & DateDep & YadioApiDep
  > =>
  async (run) => {
    const { evolu } = run.deps
    const [[account], [paymentNumber]] = await Promise.all([
      evolu.loadQuery(lightningAddressAccountByIdQuery(accountId)),
      evolu.loadQuery(paymentNumberByPaymentIdQuery(paymentId)),
    ])
    if (account === undefined || account.isDeleted === sqliteTrue) {
      return err(createLightningAddressAccountNotFoundError({ id: accountId }))
    }

    const quote = await run(
      quoteFiatAmountInSats({ currency: paymentCurrency, amount })
    )
    if (!quote.ok) return quote
    const { amountSats } = quote.value

    const metadata = await run(
      fetchLnurlPayMetadata({ address: account.address })
    )
    if (!metadata.ok) return metadata
    const { minSendableSats, maxSendableSats } = metadata.value
    if (amountSats < minSendableSats || amountSats > maxSendableSats) {
      return err(
        createLightningAddressAmountOutOfRangeError({
          amountSats,
          minSendableSats,
          maxSendableSats,
        })
      )
    }

    const invoice = await run(
      fetchLnurlPayInvoice({
        amountSats,
        metadata: metadata.value,
        comment:
          paymentNumber === undefined
            ? "Payky"
            : `Payky #${paymentNumber.serialNumber}`,
      })
    )
    if (!invoice.ok) return invoice
    const { verify } = invoice.value
    const { paymentHash } = invoice.value.invoice
    if (
      verify === undefined ||
      new URL(verify).protocol !== "https:" ||
      paymentHash === null
    ) {
      return err(createLightningAddressVerifyUnsupportedError())
    }

    return ok({
      id: paymentId,
      accountId,
      ...quote.value,
      lnInvoice: NonEmptyStringSchema.decode(invoice.value.invoice.invoice),
      paymentHash: NonEmptyStringSchema.decode(paymentHash),
      verifyUrl: NonEmptyStringSchema.decode(verify),
      invoiceExpiresAt: TimestampMsSchema.decode(
        invoice.value.invoice.expiresAt
      ),
      preimage: null,
    })
  }

export const preparePaymentMethod =
  ({
    paymentId,
    bank,
    cashRegister,
    card,
    qerkoTerminal,
    qerkoPayment,
    spark,
    lightningAddress,
  }: {
    readonly paymentId: PaymentId
    readonly bank?: {
      readonly accountId: AccountId
    }
    readonly cashRegister?: {
      readonly accountId: AccountId
    }
    readonly card?: {
      readonly accountId: AccountId
    }
    readonly qerkoTerminal?: {
      readonly accountId: AccountId
    }
    readonly qerkoPayment?: {
      readonly accountId: AccountId
    }
    readonly spark?: {
      readonly accountId: AccountId
      readonly memo?: string
      readonly expirySeconds?: number
      readonly includeSparkInvoice?: boolean
    }
    readonly lightningAddress?: {
      readonly accountId: AccountId
    }
  }): Task<
    PaymentId,
    PreparePaymentMethodError,
    EvoluDep & EvoluOwnerDep & DateDep & SparkWalletDep & FetchDep & YadioApiDep
  > =>
  async (run) => {
    const { evoluOwner } = run.deps
    // Both reads need nothing but `paymentId`, so they go together — see
    // `hasNonExpiringMethod` below for what the second one answers. Reading
    // the stored methods here rather than just before the write is safe
    // because the three `prepare*Method`s only read: every write in this
    // action happens in the one mutation batch at the end.
    const [paymentResult, nonExpiringMethods] = await Promise.all([
      run(loadPayment(paymentId)),
      run.deps.evolu.loadQuery(paymentNonExpiringMethodsByIdQuery(paymentId)),
    ])
    if (!paymentResult.ok) return paymentResult

    const payment = paymentResult.value

    // `null` means the method wasn't requested, which is not the same as
    // failing to prepare it — hence one nullable `Result` each, collapsed to
    // plain nullable values below. The cash, card and bank preparations are
    // independent reads, so they run together.
    const [
      cashRegisterResult,
      cardResult,
      qerkoResult,
      qerkoPaymentResult,
      ibanResult,
    ] = await Promise.all([
      cashRegister === undefined
        ? null
        : run(
            prepareCashRegisterMethod({
              paymentId,
              accountId: cashRegister.accountId,
              paymentCurrency: payment.currency,
            })
          ),
      card === undefined
        ? null
        : run(
            prepareCardMethod({
              paymentId,
              accountId: card.accountId,
              paymentCurrency: payment.currency,
            })
          ),
      qerkoTerminal === undefined
        ? null
        : run(
            prepareQerkoTerminalMethod({
              paymentId,
              accountId: qerkoTerminal.accountId,
              paymentCurrency: payment.currency,
            })
          ),
      qerkoPayment === undefined
        ? null
        : run(
            prepareQerkoPaymentMethod({
              paymentId,
              accountId: qerkoPayment.accountId,
              paymentCurrency: payment.currency,
            })
          ),
      bank === undefined
        ? null
        : run(
            prepareIbanMethod({
              paymentId,
              accountId: bank.accountId,
              paymentCurrency: payment.currency,
            })
          ),
    ])
    if (cashRegisterResult !== null && !cashRegisterResult.ok) {
      return cashRegisterResult
    }
    if (cardResult !== null && !cardResult.ok) return cardResult
    if (qerkoResult !== null && !qerkoResult.ok) return qerkoResult
    if (qerkoPaymentResult !== null && !qerkoPaymentResult.ok) {
      return qerkoPaymentResult
    }
    if (ibanResult !== null && !ibanResult.ok) return ibanResult

    // Spark waits its turn: it calls out to Yadio and the Spark SDK, so
    // there is no point starting that before the cheap account checks pass.
    const sparkResult =
      spark === undefined
        ? null
        : await run(
            prepareSparkMethod({
              paymentId,
              paymentCurrency: payment.currency,
              amount: payment.amount,
              spark,
            })
          )
    if (sparkResult !== null && !sparkResult.ok) return sparkResult

    // The same for the merchant's wallet, which Payky reaches over LNURL.
    const lightningAddressResult =
      lightningAddress === undefined
        ? null
        : await run(
            prepareLightningAddressMethod({
              paymentId,
              paymentCurrency: payment.currency,
              amount: payment.amount,
              accountId: lightningAddress.accountId,
            })
          )
    if (lightningAddressResult !== null && !lightningAddressResult.ok) {
      return lightningAddressResult
    }

    const cashRegisterValues = cashRegisterResult?.value ?? null
    const cardValues = cardResult?.value ?? null
    const qerkoValues = qerkoResult?.value ?? null
    const qerkoPaymentValues = qerkoPaymentResult?.value ?? null
    const ibanValues = ibanResult?.value ?? null
    const sparkValues = sparkResult?.value ?? null
    const lightningAddressValues = lightningAddressResult?.value ?? null

    if (
      cashRegisterValues === null &&
      cardValues === null &&
      qerkoValues === null &&
      qerkoPaymentValues === null &&
      ibanValues === null &&
      sparkValues === null &&
      lightningAddressValues === null
    ) {
      return ok(paymentId)
    }

    // `payment.expiresAt` describes the payment as a whole, but only some
    // methods expire: a Lightning invoice does, a cash drawer, a card
    // terminal or a bank transfer never does. The methods can coexist on one
    // payment, so the payment expires only while *every* prepared method has
    // an expiry window. Without this, preparing Lightning and then switching
    // the same payment to cash or IBAN left the old `expiresAt` behind, and 15
    // minutes later `derivePaymentStatus` reported a perfectly live cash
    // payment as `expired` — silently releasing the bill's editing lock.
    // See docs/bill-payment-states.md.
    const hasNonExpiringMethod =
      cashRegisterValues !== null ||
      cardValues !== null ||
      qerkoValues !== null ||
      qerkoPaymentValues !== null ||
      ibanValues !== null ||
      nonExpiringMethods.some(
        (row) =>
          row.cashRegisterAccountId !== null ||
          row.cardAccountId !== null ||
          row.qerkoAccountId !== null ||
          row.qerkoPaymentAccountId !== null ||
          row.ibanAccountId !== null
      )

    await runMutationWithCompletion((options) => {
      if (cashRegisterValues !== null) {
        run.deps.evolu.upsert("paymentCashRegister", cashRegisterValues, {
          ...options,
          owner: evoluOwner,
        })
      }

      if (cardValues !== null) {
        run.deps.evolu.upsert("paymentCardSwitchio", cardValues, {
          ...options,
          owner: evoluOwner,
        })
      }

      if (qerkoValues !== null) {
        run.deps.evolu.upsert("paymentQerkoTerminal", qerkoValues, {
          ...options,
          owner: evoluOwner,
        })
      }

      if (qerkoPaymentValues !== null) {
        run.deps.evolu.upsert("paymentQerkoPayment", qerkoPaymentValues, {
          ...options,
          owner: evoluOwner,
        })
      }

      if (ibanValues !== null) {
        run.deps.evolu.upsert("paymentIban", ibanValues, {
          ...options,
          owner: evoluOwner,
        })
      }

      if (sparkValues !== null) {
        upsertPaymentSparkDetails(run.deps.evolu, sparkValues.id, sparkValues, {
          ...options,
          owner: evoluOwner,
        })
      }

      if (lightningAddressValues !== null) {
        run.deps.evolu.upsert(
          "paymentLightningAddress",
          lightningAddressValues,
          { ...options, owner: evoluOwner }
        )
      }

      // Unconditional for a Lightning preparation: a new invoice always has
      // a new expiry, so keeping the previous `expiresAt` would report a live
      // payment as expired. It used to be skipped whenever the caller omitted
      // `expirySeconds`, which is exactly when the old stamp was most likely
      // to be wrong. With both prepared at once, the earlier expiry wins.
      const invoiceExpiries = [
        ...(sparkValues === null
          ? []
          : [
              computePaymentExpiresAt(
                run.deps.date.now(),
                sparkValues.expirySeconds
              ),
            ]),
        ...(lightningAddressValues === null
          ? []
          : [lightningAddressValues.invoiceExpiresAt]),
      ].filter((expiresAt): expiresAt is TimestampMs => expiresAt !== null)
      if (!hasNonExpiringMethod && invoiceExpiries.length > 0) {
        run.deps.evolu.update(
          "payment",
          {
            id: paymentId,
            expiresAt: TimestampMsSchema.decode(Math.min(...invoiceExpiries)),
          },
          { ...options, owner: evoluOwner }
        )
      }

      if (hasNonExpiringMethod && payment.expiresAt !== null) {
        run.deps.evolu.update(
          "payment",
          { id: paymentId, expiresAt: null },
          { ...options, owner: evoluOwner }
        )
      }
    })

    return ok(paymentId)
  }

/** How long a preparation waits for Linky's owners before giving up. */
const CASHU_HYDRATION_TIMEOUT_MS = 15_000

/**
 * Prepares the Cashu method of a payment (cashu.md §4, cashu/0003): the
 * sats amount from Yadio as Spark's, a mint quote at Linky's default mint
 * with its pending `topup` in the shared wallet, the `paymentCashu` row, and
 * `payment.expiresAt` from the quote under the same `hasNonExpiringMethod`
 * rule a Spark preparation follows. Spark's rows are left alone: with both
 * prepared, whichever ran last set `expiresAt`, and money that arrives after
 * the payment shows expired still settles by `quoteId`.
 */
export const prepareCashuPaymentMethod =
  ({
    paymentId,
    accountId,
    memo,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly memo?: string
  }): Task<
    PaymentId,
    | PaymentNotFoundError
    | CashuAccountNotFoundError
    | CashuWalletNotSyncedError
    | ZeroAmountNotPayableError
    | YadioHttpError
    | YadioApiError
    | FetchError
    | MintFailure,
    EvoluDep & EvoluOwnerDep & FetchDep & YadioApiDep & CashuTopupDeps
  > =>
  async (run) => {
    const { evolu, evoluOwner, cashuShardStore } = run.deps
    const [paymentResult, nonExpiringMethods, [account]] = await Promise.all([
      run(loadPayment(paymentId)),
      evolu.loadQuery(paymentNonExpiringMethodsByIdQuery(paymentId)),
      evolu.loadQuery(activeCashuAccountByIdQuery(accountId)),
    ])
    if (!paymentResult.ok) return paymentResult
    if (account === undefined)
      return err(createCashuAccountNotFoundError({ id: accountId }))
    const payment = paymentResult.value

    // Same rule as Spark: a zero-sat invoice is an amountless one.
    if (payment.amount <= 0)
      return err(createZeroAmountNotPayableError({ amount: payment.amount }))

    try {
      await cashuShardStore.whenHydrated(
        AbortSignal.timeout(CASHU_HYDRATION_TIMEOUT_MS)
      )
    } catch {
      return err(createCashuWalletNotSyncedError())
    }

    const rate = await run(fetchYadioBtcExchangeRate(payment.currency))
    if (!rate.ok) return rate
    const amountSats = fiatMinorUnitsToSats({
      amount: payment.amount,
      currency: payment.currency,
      exchangeRate: rate.value.exchangeRate,
    })
    if (amountSats <= 0)
      return err(createZeroAmountNotPayableError({ amount: payment.amount }))

    const mint = await loadCashuDefaultMint(cashuShardStore)
    const quote = await run(
      createCashuTopupQuote({
        mint,
        amount: CashuAmount(amountSats),
        ...(memo === undefined ? {} : { description: memo }),
      })
    )
    if (!quote.ok) return quote

    const hasNonExpiringMethod = nonExpiringMethods.some(
      (row) =>
        row.cashRegisterAccountId !== null ||
        row.cardAccountId !== null ||
        row.qerkoAccountId !== null ||
        row.ibanAccountId !== null
    )
    const quoteExpiresAt =
      quote.value.expiresAtSec === null
        ? null
        : TimestampMsSchema.decode(quote.value.expiresAtSec * 1000)

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      evolu.upsert(
        "paymentCashu",
        {
          id: paymentId,
          accountId,
          amountSats: NonNegativeIntegerSchema.decode(amountSats),
          exchangeRate: PositiveNumberSchema.decode(rate.value.exchangeRate),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMsSchema.decode(rate.value.fetchedAt),
          mintUrl: mint,
          quoteId: quote.value.quoteId,
          lnInvoice: NonEmptyStringSchema.decode(quote.value.invoice),
          quoteExpiresAt,
          receiveOperationId: null,
        },
        mutationOptions
      )
      evolu.update(
        "payment",
        {
          id: paymentId,
          expiresAt: hasNonExpiringMethod
            ? null
            : (quoteExpiresAt ??
              computePaymentExpiresAt(
                run.deps.date.now(),
                DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS
              )),
        },
        mutationOptions
      )
    })

    return ok(paymentId)
  }
