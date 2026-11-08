import type { Query } from "@evolu/common"
import {
  err,
  type InsertValues,
  type MutationOptions,
  ok,
  type Result,
  sqliteTrue,
  type Task,
  type UpdateValues,
} from "@evolu/common"
import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import type { EvoluSchema } from "../../evolu/schema.ts"
import { redeemLnurlWithdraw } from "../../integrations/lnurl/lnurl-withdraw-client.ts"
import {
  interpretSwitchioPaymentResult,
  type SwitchioCardPaymentResult,
  type SwitchioNativePayResult,
  type SwitchioPaymentError,
  type SwitchioTerminalDep,
} from "../../switchio.ts"
import {
  cardSwitchioAccountByIdQuery,
  cashRegisterAccountByIdQuery,
  ibanAccountByIdQuery,
} from "../account/account-queries.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  computeAccountTransactionRows,
  upsertAccountTransactionRows,
} from "../account-transaction/account-transaction-actions.ts"
import { deriveManualPaymentAccountTransactionId } from "../account-transaction/account-transaction-utils.ts"
import { requireBillAcceptingPayment } from "../bill/bill-guards.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import type { CashuOperationId } from "../cashu/cashu-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import { snapshotBillLinesForPayment } from "../payment-line/payment-line-actions.ts"
import {
  loadNextPaymentNumber,
  upsertPaymentNumberRows,
} from "../payment-number/payment-number-actions.ts"
import { paymentNumberByPaymentIdQuery } from "../payment-number/payment-number-queries.ts"
import {
  loadBillClosedAtForPayment,
  upsertReconciliationClaimRows,
} from "../reconciliation-claim/reconciliation-claim-actions.ts"
import { activeClaimedTransactionsByPaymentIdQuery } from "../reconciliation-claim/reconciliation-claim-queries.ts"
import { deriveManualReconciliationClaimId } from "../reconciliation-claim/reconciliation-claim-utils.ts"
import { sumDistinctClaimedAmounts } from "../shared/claimed-amount.ts"
import { dateToDateString } from "../shared/date-string-utils.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { currencyNumericCodes } from "../shared/money.ts"
import { getFirstOr } from "../shared/result.ts"
import {
  type FiatCurrency,
  type NonEmptyString,
  NonEmptyString255,
  NonEmptyString255Schema,
  type NonNegativeInteger,
  TimestampMs,
  TimestampMsSchema,
} from "../shared/schema.ts"
import {
  assertHasSparkIdentifier,
  type WithSparkDetails,
} from "../shared/spark-details.ts"
import type {
  PaymentRow,
  payment,
  paymentBtc,
  paymentBtcLightning,
  paymentBtcSpark,
  paymentCashRegister,
  paymentIban,
} from "./payment.ts"
import { roundCashAmount } from "./payment-cash-utils.ts"
import {
  type AccountCurrencyMismatchError,
  type CardSwitchioAccountNotFoundError,
  type CreatePaymentError,
  createCardSwitchioAccountNotFoundError,
  createCashReceivedBelowChargeError,
  createCashRegisterAccountNotFoundError,
  createIbanAccountNotFoundError,
  createPaymentAlreadyPaidError,
  createPaymentCanceledError,
  createPaymentLightningInvoiceNotFoundError,
  createPaymentNotCanceledError,
  createPaymentNotClaimedError,
  createPaymentNotFoundError,
  createPaymentNotOverpaidError,
  createSwitchioAttemptUnresolvedError,
  createSwitchioRestoredResultUnmatchedError,
  type MarkPaymentPaidCashError,
  type MarkPaymentPaidIbanError,
  type PaymentAlreadyPaidError,
  type PaymentCanceledError,
  type PaymentNotCanceledError,
  type PaymentNotClaimedError,
  type PaymentNotFoundError,
  type PaymentNotOverpaidError,
  type PayPaymentWithBoltCardError,
  type PayPaymentWithSwitchioCardError,
  type SettleRestoredSwitchioCardPaymentError,
} from "./payment-errors.ts"
import {
  loadAccountWithCurrencyCheck,
  loadPaymentHasActiveClaim,
  requirePayablePayment,
} from "./payment-guards.ts"
import {
  paymentByIdQuery,
  paymentCardSwitchioByIdQuery,
  paymentCardSwitchioByTransactionIdQuery,
  paymentLightningAddressByIdQuery,
  paymentSparkDetailsByIdQuery,
} from "./payment-queries.ts"
import { createVariableSymbolFromSerialNumber } from "./payment-symbol-utils.ts"
import { calculatePaymentBaseAmount } from "./payment-tip-utils.ts"
import type { PaymentAccountKind, PaymentId } from "./payment-types.ts"

/**
 * Reads an optional 255-char column, dropping an over-long value rather than
 * throwing on it: the terminal result fields it reads are only there for
 * tracing a transaction, and losing one of them must never fail a payment
 * whose card was already charged.
 */
export const optionalNonEmptyString255 = (
  value: string | null | undefined
): NonEmptyString255 | null => {
  if (value === null || value === undefined || value === "") return null

  const parsed = NonEmptyString255Schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export type PaymentBtcInput = WithSparkDetails<
  Omit<InsertValues<typeof paymentBtc>, "id">,
  Omit<InsertValues<typeof paymentBtcLightning>, "id">,
  Omit<InsertValues<typeof paymentBtcSpark>, "id">
>

type PaymentBtcUpdateInput = WithSparkDetails<
  Omit<UpdateValues<typeof paymentBtc>, "id">,
  Omit<UpdateValues<typeof paymentBtcLightning>, "id">,
  Omit<UpdateValues<typeof paymentBtcSpark>, "id">
>

/**
 * Writes a payment's Spark detail rows: the `paymentBtc` base row plus
 * whichever of `paymentBtcLightning`/`paymentBtcSpark` the quote produced.
 * Shared by `createPayment` and `preparePaymentMethod`, which must agree on
 * exactly this field set — a payment prepared through one path would
 * otherwise carry different Spark details than through the other.
 *
 * Upsert only. `updatePayment` writes the same three tables with `update`,
 * whose values are all-optional where `UpsertValues` requires every
 * non-nullable column, so folding both modes in here would mean widening this
 * to accept a partial `paymentBtc` — losing the guarantee that a created
 * payment has a complete Spark row.
 */
export const upsertPaymentSparkDetails = (
  evolu: EvoluDep["evolu"],
  id: PaymentId,
  spark: PaymentBtcInput,
  options: MutationOptions
): void => {
  evolu.upsert(
    "paymentBtc",
    removeUndefinedValues({
      accountId: spark.accountId,
      amountSats: spark.amountSats,
      exchangeRate: spark.exchangeRate,
      exchangeRateSource: spark.exchangeRateSource,
      exchangeRateFetchedAt: spark.exchangeRateFetchedAt,
      id,
    }),
    options
  )
  if (spark.lightning) {
    evolu.upsert(
      "paymentBtcLightning",
      removeUndefinedValues({ ...spark.lightning, id }),
      options
    )
  }
  if (spark.sparkInvoice) {
    evolu.upsert(
      "paymentBtcSpark",
      removeUndefinedValues({ ...spark.sparkInvoice, id }),
      options
    )
  }
}

export const loadPayment =
  (idValue: PaymentId): Task<PaymentRow, PaymentNotFoundError, EvoluDep> =>
  async (run) =>
    getFirstOr(
      await run.deps.evolu.loadQuery(paymentByIdQuery(idValue)),
      createPaymentNotFoundError({ id: idValue })
    )

export const createPayment =
  ({
    cashRegister,
    spark,
    iban,
    ...input
  }: InsertValues<typeof payment> & {
    readonly cashRegister?: Omit<InsertValues<typeof paymentCashRegister>, "id">
    readonly spark?: PaymentBtcInput
    readonly iban?: Omit<InsertValues<typeof paymentIban>, "id">
  }): Task<PaymentId, CreatePaymentError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    assertHasSparkIdentifier(
      spark,
      "Spark payment requires lnInvoice or sparkInvoice."
    )

    // A new payment attempt requires the bill to still be `open` — but does
    // not check for an already-pending payment on it: split payments mean
    // more than one payment can legitimately be in flight for the same bill
    // at once. See docs/bill-payment-states.md.
    // Frozen for `snapshotBillLinesForPayment` below — captured from this
    // device's own local view, before the mutation batch, since it can't be
    // reliably reconstructed later from `billLine.createdAt` (see that
    // function's doc comment). Taken off the guard's own result rather than
    // reloaded after it: the guard derives the bill's status from exactly
    // this projection, so this both saves a second sequential round trip and
    // freezes the same read the guard just accepted.
    const billId = input.billId ?? null
    let billLineSnapshot: ReadonlyArray<BillLineSummary> | null = null
    if (billId !== null) {
      const openResult = await run(requireBillAcceptingPayment(billId))
      if (!openResult.ok) return openResult
      billLineSnapshot = openResult.value.items
    }

    const id = createRowId<"Payment">()
    const { evoluOwner } = run.deps
    const paymentNumber = await run.ok(
      loadNextPaymentNumber({
        id,
        date: dateToDateString(run.deps.date.now()),
      })
    )

    await runMutationWithCompletion((options) => {
      upsertPaymentNumberRows(run.deps.evolu, paymentNumber, {
        ...options,
        owner: evoluOwner,
      })

      if (cashRegister) {
        run.deps.evolu.upsert(
          "paymentCashRegister",
          removeUndefinedValues({
            ...cashRegister,
            id,
          }),
          { ...options, owner: evoluOwner }
        )
      }

      if (spark) {
        upsertPaymentSparkDetails(run.deps.evolu, id, spark, {
          ...options,
          owner: evoluOwner,
        })
      }

      if (iban) {
        run.deps.evolu.upsert(
          "paymentIban",
          removeUndefinedValues({
            ...iban,
            id,
          }),
          { ...options, owner: evoluOwner }
        )
      }

      if (billLineSnapshot !== null) {
        snapshotBillLinesForPayment(run.deps.evolu, id, billLineSnapshot, {
          ...options,
          owner: evoluOwner,
        })
      }

      return run.deps.evolu.upsert(
        "payment",
        removeUndefinedValues({
          ...input,
          id,
        }),
        { ...options, owner: evoluOwner }
      )
    })

    return ok(id)
  }

export const updatePayment =
  ({
    cashRegister,
    spark,
    iban,
    ...input
  }: Pick<
    UpdateValues<typeof payment>,
    | "id"
    | "deviceId"
    | "billId"
    | "tableId"
    | "amount"
    | "currency"
    | "tipAmount"
    | "canceledAt"
  > & {
    readonly cashRegister?: Omit<UpdateValues<typeof paymentCashRegister>, "id">
    readonly spark?: PaymentBtcUpdateInput
    readonly iban?: Omit<UpdateValues<typeof paymentIban>, "id">
  }): Task<PaymentId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) => {
      if (cashRegister) {
        run.deps.evolu.update(
          "paymentCashRegister",
          removeUndefinedValues({
            ...cashRegister,
            id: input.id,
          }),
          { ...options, owner: evoluOwner }
        )
      }

      if (spark) {
        run.deps.evolu.update(
          "paymentBtc",
          removeUndefinedValues({
            accountId: spark.accountId,
            amountSats: spark.amountSats,
            exchangeRate: spark.exchangeRate,
            exchangeRateSource: spark.exchangeRateSource,
            exchangeRateFetchedAt: spark.exchangeRateFetchedAt,
            id: input.id,
          }),
          { ...options, owner: evoluOwner }
        )
        if (spark.lightning) {
          run.deps.evolu.update(
            "paymentBtcLightning",
            removeUndefinedValues({
              ...spark.lightning,
              id: input.id,
            }),
            { ...options, owner: evoluOwner }
          )
        }
        if (spark.sparkInvoice) {
          run.deps.evolu.update(
            "paymentBtcSpark",
            removeUndefinedValues({
              ...spark.sparkInvoice,
              id: input.id,
            }),
            { ...options, owner: evoluOwner }
          )
        }
      }

      if (iban) {
        run.deps.evolu.update(
          "paymentIban",
          removeUndefinedValues({
            ...iban,
            id: input.id,
          }),
          { ...options, owner: evoluOwner }
        )
      }

      return run.deps.evolu.update("payment", removeUndefinedValues(input), {
        ...options,
        owner: evoluOwner,
      })
    })

    return ok(input.id)
  }

export const deletePayment =
  (paymentId: PaymentId): Task<PaymentId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "payment",
        {
          id: paymentId,
          isDeleted: sqliteTrue,
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(paymentId)
  }

interface MarkPaymentPaidInput {
  readonly paymentId: PaymentId
  readonly accountId: AccountId
  readonly deviceId?: DeviceId | null
  readonly occurredAt?: TimestampMs
  readonly note?: NonEmptyString | null
}

/**
 * Records staff confirming that money for a payment arrived on one of their
 * own accounts, as an `accountTransaction` claimed against that payment.
 *
 * The account kind is the only thing that varies: which query finds it, which
 * not-found error it reports, and the prefix of the transaction's id. That id
 * is content-derived so a retried confirmation re-uses the row instead of
 * recording the money twice; `deriveManualPaymentAccountTransactionId` owns
 * the prefixes.
 */
export const markPaymentPaid =
  <TRow extends { readonly currency: FiatCurrency }, TNotFoundError>({
    accountKind,
    accountQuery,
    notFoundError,
    receivedCashAmount,
    chargedAmount,
    paymentId,
    accountId,
    deviceId,
    occurredAt,
    note,
  }: MarkPaymentPaidInput & {
    readonly accountKind: PaymentAccountKind
    readonly accountQuery: (accountId: AccountId) => Query<EvoluSchema, TRow>
    readonly notFoundError: TNotFoundError
    readonly receivedCashAmount?: NonNegativeInteger
    /**
     * What the account actually received, when it is not the payment's own
     * `amount`: a card terminal reports what it charged, tip added on the
     * terminal included (qerko/0002). The excess then reads as an overpayment
     * through the ordinary coverage rule.
     */
    readonly chargedAmount?: NonNegativeInteger
  }): Task<
    PaymentId,
    PaymentNotFoundError | TNotFoundError | AccountCurrencyMismatchError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult

    const payment = paymentResult.value
    const accountResult = loadAccountWithCurrencyCheck({
      rows: await run.deps.evolu.loadQuery(accountQuery(accountId)),
      notFoundError,
      accountKind,
      accountId,
      expectedCurrency: payment.currency,
    })
    if (!accountResult.ok) return accountResult

    // Computed up front rather than written through `createAccountTransaction`
    // and `claimManualReconciliation` as two separate mutation batches: the
    // account transaction's id is content-derived (no write needed to learn
    // it), and `loadBillClosedAtForPayment` reads only already-committed data
    // plus this not-yet-written claim's own values — so both writes can join
    // one batch below instead of leaving a window where the money moved but
    // nothing claims it (a crash or failed second batch used to strand it
    // there permanently).
    const accountTransaction = computeAccountTransactionRows(
      {
        id: deriveManualPaymentAccountTransactionId({
          accountKind,
          paymentId,
          accountId,
        }),
        accountId,
        // The money landed on an account of this kind, and nothing else
        // records the movement: there is no bank statement row behind a
        // hand-confirmed transfer, so no `iban` detail implies the kind.
        kind: accountKind,
        amount: chargedAmount ?? payment.amount,
        currency: payment.currency,
        occurredAt:
          occurredAt ?? TimestampMsSchema.decode(run.deps.date.now().getTime()),
        note: note ?? null,
        internalTransferGroupId: null,
        source: {
          deviceId: deviceId ?? null,
          source: "manual",
        },
      },
      run.deps.date.now()
    )
    const claim = {
      id: deriveManualReconciliationClaimId(paymentId, accountTransaction.id),
      deviceId: deviceId ?? null,
      paymentId,
      accountTransactionId: accountTransaction.id,
      source: "manual" as const,
      claimedAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
    }
    const billClosing = await run.ok(
      loadBillClosedAtForPayment(paymentId, {
        id: accountTransaction.id,
        kind: accountTransaction.kind,
        amount: accountTransaction.input.amount,
        currency: accountTransaction.input.currency,
      })
    )

    const { evoluOwner } = run.deps
    await runMutationWithCompletion((options) => {
      upsertAccountTransactionRows(run.deps.evolu, accountTransaction, {
        ...options,
        owner: evoluOwner,
      })
      upsertReconciliationClaimRows(run.deps.evolu, claim, billClosing, {
        ...options,
        owner: evoluOwner,
      })
      if (receivedCashAmount !== undefined) {
        run.deps.evolu.upsert(
          "paymentCashRegister",
          { id: paymentId, accountId, receivedAmount: receivedCashAmount },
          { ...options, owner: evoluOwner }
        )
      }
    })

    return ok(paymentId)
  }

/**
 * The guard in front of staff confirming money by hand (payment/0004): a
 * payment they canceled is not one they can then mark paid. Only the manual
 * cash and IBAN confirmations use it — the automatic matcher and a card
 * terminal's result record money that really arrived, canceled or not.
 */
const loadUncanceledPayment =
  (
    paymentId: PaymentId
  ): Task<PaymentRow, PaymentNotFoundError | PaymentCanceledError, EvoluDep> =>
  async (run) => {
    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult
    if (paymentResult.value.canceledAt !== null) {
      return err(createPaymentCanceledError({ id: paymentId }))
    }
    return paymentResult
  }

export const markPaymentPaidCash =
  ({
    receivedAmount,
    ...input
  }: MarkPaymentPaidInput & {
    readonly receivedAmount?: NonNegativeInteger
  }): Task<
    PaymentId,
    MarkPaymentPaidCashError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadUncanceledPayment(input.paymentId))
    if (!paymentResult.ok) return paymentResult

    if (receivedAmount !== undefined) {
      const leastReceivedAmount = roundCashAmount(paymentResult.value)
      if (receivedAmount < leastReceivedAmount) {
        return err(
          createCashReceivedBelowChargeError({
            receivedAmount,
            leastReceivedAmount,
          })
        )
      }
    }

    return await run(
      markPaymentPaid({
        ...input,
        accountKind: "cashRegister",
        accountQuery: cashRegisterAccountByIdQuery,
        notFoundError: createCashRegisterAccountNotFoundError({
          id: input.accountId,
        }),
        receivedCashAmount: receivedAmount,
      })
    )
  }

/**
 * Manual counterpart to the Fio-plugin auto-settlement: staff confirming
 * they've checked their bank and the transfer for this payment arrived,
 * since the auto-detection sync job only runs in the native app.
 */
export const markPaymentPaidIban =
  (
    input: MarkPaymentPaidInput
  ): Task<
    PaymentId,
    MarkPaymentPaidIbanError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadUncanceledPayment(input.paymentId))
    if (!paymentResult.ok) return paymentResult

    return await run(
      markPaymentPaid({
        ...input,
        accountKind: "iban",
        accountQuery: ibanAccountByIdQuery,
        notFoundError: createIbanAccountNotFoundError({ id: input.accountId }),
      })
    )
  }

/**
 * Records what the SwitchioPay terminal answered for one attempt — shared by
 * `payPaymentWithSwitchioCard` and `settleRestoredSwitchioCardPayment`, since
 * a result that only arrives after Android restarted the app means exactly
 * the same thing.
 *
 * On success this mirrors `markPaymentPaidCash`: one account transaction
 * keyed on payment + account (so a repeated result settles once, not twice)
 * and one reconciliation claim, which is what makes `derivePaymentStatus`
 * report the payment as paid. A definite failure clears the attempt's
 * `unresolvedTransactionId`; an unreadable result leaves it set, because the
 * card may have been charged. See docs/bill-payment-states.md.
 */
const recordSwitchioTerminalOutcome =
  ({
    paymentId,
    accountId,
    deviceId,
    transactionId,
    terminalResult,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly deviceId?: DeviceId | null
    readonly transactionId: NonEmptyString255
    readonly terminalResult: Result<
      SwitchioCardPaymentResult,
      SwitchioPaymentError
    >
  }): Task<
    PaymentId,
    | PaymentNotFoundError
    | CardSwitchioAccountNotFoundError
    | AccountCurrencyMismatchError
    | SwitchioPaymentError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const { evoluOwner } = run.deps

    if (!terminalResult.ok) {
      run.deps.console.warn("[payment] Switchio card payment failed", {
        paymentId,
        transactionId,
        error: terminalResult.error,
      })

      if (terminalResult.error.type !== "SwitchioResultUnreadable") {
        // Only this attempt's own marker is cleared: a late result for an
        // older attempt must not resolve a newer one that is still unknown.
        const [cardRow] = await run.deps.evolu.loadQuery(
          paymentCardSwitchioByIdQuery(paymentId)
        )
        if (cardRow?.unresolvedTransactionId === transactionId) {
          await runMutationWithCompletion((options) =>
            run.deps.evolu.update(
              "paymentCardSwitchio",
              { id: paymentId, unresolvedTransactionId: null },
              { ...options, owner: evoluOwner }
            )
          )
        }
      }

      return terminalResult
    }

    // Transaction and claim land in one batch through `markPaymentPaid`, and
    // before the terminal's trace fields on purpose: the claim is what makes
    // the payment read as paid, so if the app dies mid-way the worst outcome
    // is a paid payment with a thinner audit trail rather than a charged card
    // that still shows as unpaid. `occurredAt` defaults to now — the card was
    // approved just now, not when the intent was launched. No payment-status
    // guard here: the card has been charged, so the money is recorded even
    // on a payment that got canceled meanwhile.
    const settleResult = await run(
      markPaymentPaid({
        paymentId,
        accountId,
        deviceId,
        accountKind: "cardSwitchio",
        accountQuery: cardSwitchioAccountByIdQuery,
        notFoundError: createCardSwitchioAccountNotFoundError({
          id: accountId,
        }),
      })
    )
    if (!settleResult.ok) return settleResult

    const result = terminalResult.value
    const [cardRow] = await run.deps.evolu.loadQuery(
      paymentCardSwitchioByIdQuery(paymentId)
    )
    // The same result recorded again — through its promise, then restored —
    // keeps the moment it was first recorded.
    const approvedAt =
      cardRow?.transactionId === transactionId && cardRow.approvedAt !== null
        ? cardRow.approvedAt
        : TimestampMs(run.deps.date.now().getTime())
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "paymentCardSwitchio",
        {
          id: paymentId,
          transactionId,
          unresolvedTransactionId: null,
          responseCode: optionalNonEmptyString255(result.responseCode),
          authCode: optionalNonEmptyString255(result.authCode),
          sequenceNumber: optionalNonEmptyString255(result.sequenceNumber),
          maskedPan: optionalNonEmptyString255(result.maskedPan),
          cardLabel: optionalNonEmptyString255(result.cardLabel),
          terminalId: optionalNonEmptyString255(result.terminalId),
          terminalDateTime: optionalNonEmptyString255(result.terminalDateTime),
          refundId: optionalNonEmptyString255(result.refundId),
          deviceId: deviceId ?? null,
          approvedAt,
        },
        { ...options, owner: evoluOwner }
      )
    )

    return settleResult
  }

/**
 * Takes a card payment on the SwitchioPay terminal and settles it.
 *
 * Refuses before the terminal is asked when the payment can no longer take
 * money: another method on the same payment may already have settled it, and
 * the payment-wait screen's own `isPaid` check trails behind the database.
 *
 * The ECR request id is persisted *before* control leaves for SwitchioPay,
 * both as `transactionId` and as `unresolvedTransactionId`: Android may kill
 * this WebView while the terminal app is in the foreground, and with the id
 * stored the result can still be matched (`settleRestoredSwitchioCardPayment`)
 * or, failing that, checked against the terminal's own records. While the
 * previous attempt is unresolved, another one needs `retryUnresolved` — the
 * caller's confirmation that staff has checked SwitchioPay.
 */
export const payPaymentWithSwitchioCard =
  ({
    paymentId,
    accountId,
    deviceId,
    retryUnresolved = false,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly deviceId?: DeviceId | null
    readonly retryUnresolved?: boolean
  }): Task<
    PaymentId,
    PayPaymentWithSwitchioCardError,
    EvoluDep & EvoluOwnerDep & DateDep & SwitchioTerminalDep
  > =>
  async (run) => {
    const { evoluOwner } = run.deps
    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult

    const payment = paymentResult.value
    const accountResult = loadAccountWithCurrencyCheck({
      rows: await run.deps.evolu.loadQuery(
        cardSwitchioAccountByIdQuery(accountId)
      ),
      notFoundError: createCardSwitchioAccountNotFoundError({
        id: accountId,
      }),
      accountKind: "cardSwitchio",
      accountId,
      expectedCurrency: payment.currency,
    })
    if (!accountResult.ok) return accountResult

    const payable = await run(requirePayablePayment(payment))
    if (!payable.ok) return payable

    const [cardRows, paymentNumbers] = await Promise.all([
      run.deps.evolu.loadQuery(paymentCardSwitchioByIdQuery(paymentId)),
      run.deps.evolu.loadQuery(paymentNumberByPaymentIdQuery(paymentId)),
    ])

    const unresolvedTransactionId = cardRows[0]?.unresolvedTransactionId
    if (
      unresolvedTransactionId !== null &&
      unresolvedTransactionId !== undefined &&
      !retryUnresolved
    ) {
      return err(
        createSwitchioAttemptUnresolvedError({
          id: paymentId,
          transactionId: unresolvedTransactionId,
        })
      )
    }

    const paymentNumber = paymentNumbers[0]
    const transactionId = NonEmptyString255(
      `${paymentId}-${run.deps.date.now().getTime()}`
    )

    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "paymentCardSwitchio",
        {
          id: paymentId,
          accountId,
          transactionId,
          unresolvedTransactionId: transactionId,
        },
        { ...options, owner: evoluOwner }
      )
    )

    const terminalResult = await run.deps.switchioTerminal.pay(
      removeUndefinedValues({
        transactionId,
        // ECR takes the amount *without* the tip and adds `tipAmount` to it
        // itself — its result documents `amount` as the total including the
        // tip, while the request's does not. Passing the stored
        // tip-inclusive total here charged the tip twice.
        amount: calculatePaymentBaseAmount(payment),
        tipAmount: payment.tipAmount,
        currencyCode: currencyNumericCodes[payment.currency],
        invoiceNumber:
          paymentNumber === undefined
            ? undefined
            : createVariableSymbolFromSerialNumber(paymentNumber.serialNumber),
      })
    )

    return run(
      recordSwitchioTerminalOutcome({
        paymentId,
        accountId,
        deviceId,
        transactionId,
        terminalResult,
      })
    )
  }

/**
 * Pays a payment's Lightning invoice from the Bolt Card whose `lnurlw://`
 * link was read over NFC. Writes nothing: `ok` only means the card's service
 * accepted the invoice, and the payment reads as paid once the Spark sync
 * sees the invoice settle — exactly as when a wallet scans the QR. Retrying
 * cannot charge twice, since a Lightning invoice can only be paid once.
 */
export const payPaymentWithBoltCard =
  ({
    paymentId,
    uri,
    method = "spark",
  }: {
    readonly paymentId: PaymentId
    readonly uri: string
    /**
     * Whose invoice the card pays: the tab it was tapped on. The other
     * method's invoice stands in when this one has none.
     */
    readonly method?: "spark" | "lightningAddress"
  }): Task<void, PayPaymentWithBoltCardError, EvoluDep & DateDep & FetchDep> =>
  async (run) => {
    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult

    const payment = paymentResult.value
    const payable = await run(requirePayablePayment(payment))
    if (!payable.ok) return payable

    const [[spark], [lightningAddress]] = await Promise.all([
      run.deps.evolu.loadQuery(paymentSparkDetailsByIdQuery(paymentId)),
      run.deps.evolu.loadQuery(paymentLightningAddressByIdQuery(paymentId)),
    ])
    const sparkInvoice =
      spark?.lnInvoice === null || spark?.lnInvoice === undefined
        ? null
        : { invoice: spark.lnInvoice, amountSats: spark.amountSats }
    const lightningAddressInvoice =
      lightningAddress === undefined
        ? null
        : {
            invoice: lightningAddress.lnInvoice,
            amountSats: lightningAddress.amountSats,
          }
    const invoice =
      method === "lightningAddress"
        ? (lightningAddressInvoice ?? sparkInvoice)
        : (sparkInvoice ?? lightningAddressInvoice)
    if (invoice === null) {
      return err(createPaymentLightningInvoiceNotFoundError({ id: paymentId }))
    }

    return run(redeemLnurlWithdraw({ uri, ...invoice }))
  }

/**
 * Settles a SwitchioPay result that Capacitor delivered as an
 * `appRestoredResult` event: Android killed the app while the terminal was
 * in the foreground, so the promise `payPaymentWithSwitchioCard` awaited is
 * gone. The echoed request id finds the payment the attempt was made for.
 */
export const settleRestoredSwitchioCardPayment =
  ({
    restored,
    deviceId,
  }: {
    readonly restored: SwitchioNativePayResult
    readonly deviceId?: DeviceId | null
  }): Task<
    PaymentId,
    SettleRestoredSwitchioCardPaymentError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const transactionId = optionalNonEmptyString255(restored.transactionId)
    const [cardRow] =
      transactionId === null
        ? []
        : await run.deps.evolu.loadQuery(
            paymentCardSwitchioByTransactionIdQuery(transactionId)
          )
    if (transactionId === null || cardRow === undefined) {
      return err(
        createSwitchioRestoredResultUnmatchedError({
          transactionId: restored.transactionId,
        })
      )
    }

    return run(
      recordSwitchioTerminalOutcome({
        paymentId: cardRow.id,
        accountId: cardRow.accountId,
        deviceId,
        transactionId,
        terminalResult: interpretSwitchioPaymentResult(restored),
      })
    )
  }

export const cancelPayment =
  (
    paymentId: PaymentId
  ): Task<
    PaymentId,
    PaymentAlreadyPaidError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    // A payment that already has an active claim (money arrived) cannot be
    // canceled — mirrors the bill-side guard that a paid bill cannot be
    // canceled. A concurrent multi-device merge can still race past this on
    // a single device's check; that residual case is resolved by
    // `derivePaymentStatus`'s precedence, not by this guard. See
    // docs/bill-payment-states.md.
    if (await run.ok(loadPaymentHasActiveClaim(paymentId))) {
      return err(createPaymentAlreadyPaidError({ id: paymentId }))
    }

    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "payment",
        {
          id: paymentId,
          canceledAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(paymentId)
  }

export type ConfirmPaymentPaidDespiteCancellationError =
  | PaymentNotFoundError
  | PaymentNotCanceledError
  | PaymentNotClaimedError

/**
 * Resolves the canceled+claimed collision described in
 * docs/bill-payment-states.md: a multi-device merge can leave a payment with
 * both `canceledAt` set and an active `reconciliationClaim` — money that
 * genuinely arrived — which `derivePaymentStatus` displays as Canceled by
 * default. This lets staff explicitly acknowledge that and flip the
 * *display* back to Paid via `confirmedPaidAt`, set once and never cleared,
 * mirroring `canceledAt`'s own style.
 *
 * Requires both `canceledAt` and an active claim to already be set — this
 * resolves an existing collision, it does not create a way to mark an
 * arbitrary payment paid without a claim behind it. Coverage math keeps
 * reading claims only; this field never feeds into it.
 */
export const confirmPaymentPaidDespiteCancellation =
  (
    paymentId: PaymentId
  ): Task<
    PaymentId,
    ConfirmPaymentPaidDespiteCancellationError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult
    if (paymentResult.value.canceledAt === null) {
      return err(createPaymentNotCanceledError({ id: paymentId }))
    }

    if (!(await run.ok(loadPaymentHasActiveClaim(paymentId)))) {
      return err(createPaymentNotClaimedError({ id: paymentId }))
    }

    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "payment",
        {
          id: paymentId,
          confirmedPaidAt: TimestampMsSchema.decode(
            run.deps.date.now().getTime()
          ),
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(paymentId)
  }

export type AcknowledgePaymentExcessSettlementError =
  | PaymentNotFoundError
  | PaymentNotOverpaidError

/**
 * Resolves the duplicate-settlement collision described in
 * docs/bill-payment-states.md and `payment.ts`'s `excessAcknowledgedAt` doc
 * comment: two offline devices can each independently claim the same
 * payment through a different method (e.g. one settles it in cash while
 * another reconciles a matching incoming bank transfer), and since each
 * claim is real money, neither is discarded on merge — the payment simply
 * ends up claimed for more than its own `amount`.
 *
 * This lets staff explicitly acknowledge that (e.g. once they've refunded
 * the excess, or decided to keep it) via `excessAcknowledgedAt`, set once
 * and never cleared. Requires the payment to actually be claimed for more
 * than its `amount` — this resolves an existing collision, it does not
 * silence a warning that isn't there.
 */
export const acknowledgePaymentExcessSettlement =
  (
    paymentId: PaymentId
  ): Task<
    PaymentId,
    AcknowledgePaymentExcessSettlementError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult

    const claimedTransactions = await run.deps.evolu.loadQuery(
      activeClaimedTransactionsByPaymentIdQuery(paymentId)
    )
    const claimedSum = sumDistinctClaimedAmounts(claimedTransactions)
    if (claimedSum <= paymentResult.value.amount) {
      return err(createPaymentNotOverpaidError({ id: paymentId }))
    }

    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "payment",
        {
          id: paymentId,
          excessAcknowledgedAt: TimestampMsSchema.decode(
            run.deps.date.now().getTime()
          ),
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(paymentId)
  }

/**
 * Makes the payment hold the receive of a token sent for it, before anyone
 * receives it (cashu.md §5): the id comes from the token text alone, so it is
 * right whether Payky, a running Linky or another device swaps the token.
 */
export const holdCashuReceive =
  ({
    paymentId,
    receiveOperationId,
  }: {
    readonly paymentId: PaymentId
    readonly receiveOperationId: CashuOperationId
  }): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "paymentCashu",
        { id: paymentId, receiveOperationId },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok(undefined)
  }
