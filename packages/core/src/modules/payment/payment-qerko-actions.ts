import { err, ok, type Task, type UpdateValues } from "@evolu/common"

import type { DateDep, EvoluOwnerDep, FetchDep, UuidDep } from "../../deps.ts"
import {
  cancelQerkoTerminalPayment as cancelQerkoTerminalPaymentRequest,
  createQerkoTerminalPayment,
  getQerkoTerminalPaymentStatus,
  type QerkoApiDep,
  type QerkoCancelResult,
  type QerkoClientError,
  type QerkoPayment,
  type QerkoStep,
} from "../../integrations/qerko/qerko-client.ts"
import { qerkoTerminalAccountByIdQuery } from "../account/account-queries.ts"
import type { AccountId } from "../account/account-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import { paymentNumberByPaymentIdQuery } from "../payment-number/payment-number-queries.ts"
import {
  loadQerkoCredentials,
  type QerkoPluginNotPairedError,
} from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import {
  NonEmptyString255,
  type NonEmptyString255 as NonEmptyString255Value,
  NonNegativeInteger,
  TimestampMsSchema,
} from "../shared/schema.ts"
import type { paymentQerkoTerminal } from "./payment.ts"
import {
  loadPayment,
  markPaymentPaid,
  optionalNonEmptyString255,
} from "./payment-actions.ts"
import {
  type AccountCurrencyMismatchError,
  createQerkoAttemptUnresolvedError,
  createQerkoTerminalAccountNotFoundError,
  createQerkoTerminalNotStartedError,
  createQerkoTerminalPaymentFailedError,
  type PaymentNotFoundError,
  type QerkoTerminalAccountNotFoundError,
  type QerkoTerminalPaymentFailedError,
  type StartQerkoTerminalPaymentError,
  type SyncQerkoTerminalPaymentError,
} from "./payment-errors.ts"
import {
  loadAccountWithCurrencyCheck,
  requirePayablePayment,
} from "./payment-guards.ts"
import { paymentQerkoTerminalByIdQuery } from "./payment-queries.ts"
import { createVariableSymbolFromSerialNumber } from "./payment-symbol-utils.ts"
import type { PaymentId } from "./payment-types.ts"

/**
 * Taking a card payment on a terminal Qerko drives remotely (qerko/0001..0005).
 * The whole lifecycle is described on `paymentQerkoTerminal`; in short, an
 * attempt is stored as pending *before* Qerko is asked, and whoever polls it
 * (the screen, or the background job on any device) settles it from Qerko's
 * answer.
 */

/**
 * How long a pending attempt Qerko has never heard of is still believed. The
 * attempt is stored before the request leaves, and the row syncs at once, so
 * another device polling in that window gets `unknownTransaction` for a
 * payment that is only about to reach the terminal. Ending it then would
 * orphan a live payment; after this long the request is taken as lost.
 */
export const qerkoUnknownAttemptGraceMs = 3 * 60 * 1000

/** Where a payment's Qerko attempt stands after one start or poll. */
export type QerkoTerminalPaymentProgress =
  | { readonly status: "idle" }
  | { readonly status: "pending"; readonly step: QerkoStep }
  | { readonly status: "paid" }
  /** The outcome is unknown: the card may have been charged (payment/0006). */
  | { readonly status: "unresolved" }

type QerkoPaymentDeps = EvoluDep &
  EvoluOwnerDep &
  DateDep &
  QerkoApiDep &
  FetchDep

/**
 * Writes down what Qerko answered for one attempt. Only the markers of *this*
 * attempt are cleared (compared against `attemptId`), so a late answer for an
 * older attempt cannot resolve a newer one that is still running.
 */
const applyQerkoPayment =
  ({
    paymentId,
    accountId,
    deviceId,
    attemptId,
    operation,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly deviceId?: DeviceId | null
    readonly attemptId: NonEmptyString255Value
    readonly operation: QerkoPayment
  }): Task<
    QerkoTerminalPaymentProgress,
    | PaymentNotFoundError
    | QerkoTerminalAccountNotFoundError
    | AccountCurrencyMismatchError
    | QerkoTerminalPaymentFailedError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const { evoluOwner } = run.deps

    if (operation.status === "pending") {
      return ok({ status: "pending", step: operation.step })
    }

    const updateAttempt = async ({
      unresolve = false,
      trace = {},
    }: {
      readonly unresolve?: boolean
      readonly trace?: Omit<UpdateValues<typeof paymentQerkoTerminal>, "id">
    }) => {
      const [row] = await run.deps.evolu.loadQuery(
        paymentQerkoTerminalByIdQuery(paymentId)
      )
      if (row === undefined) return
      await runMutationWithCompletion((options) =>
        run.deps.evolu.update(
          "paymentQerkoTerminal",
          {
            id: paymentId,
            ...trace,
            ...(row.pendingTransactionId === attemptId
              ? { pendingTransactionId: null, pendingSince: null }
              : {}),
            ...(unresolve
              ? { unresolvedTransactionId: attemptId }
              : row.unresolvedTransactionId === attemptId
                ? { unresolvedTransactionId: null }
                : {}),
          },
          { ...options, owner: evoluOwner }
        )
      )
    }

    if (operation.status === "failed") {
      await updateAttempt({ trace: { failureReason: operation.reason } })
      return err(
        createQerkoTerminalPaymentFailedError({
          id: paymentId,
          reason: operation.reason,
        })
      )
    }

    if (operation.status === "unknown") {
      // The terminal may have charged the card: the attempt stays, as
      // unresolved, until staff confirm a retry (payment/0006).
      await updateAttempt({ unresolve: true })
      return ok({ status: "unresolved" })
    }

    // The claim lands before the trace fields on purpose, as for Switchio: it
    // is what makes the payment read as paid, so a crash in between leaves a
    // paid payment with a thinner audit trail, not a charged card that still
    // shows as unpaid. No status guard: the card has been charged, even on a
    // payment canceled meanwhile (payment/0004). The account receives what
    // the card was charged, a tip added on the terminal included (qerko/0002).
    const settled = await run(
      markPaymentPaid({
        paymentId,
        accountId,
        deviceId,
        chargedAmount: NonNegativeInteger(operation.chargedAmount),
        accountKind: "qerkoTerminal",
        // The terminal approved the card, not staff (payment/0010).
        source: "auto",
        accountQuery: qerkoTerminalAccountByIdQuery,
        notFoundError: createQerkoTerminalAccountNotFoundError({
          id: accountId,
        }),
      })
    )
    if (!settled.ok) return settled

    // `receipt.terminalId` is the acquirer's id, not the Qerko terminal the
    // payment was sent to, so `terminalId` keeps the id this attempt started
    // with; `qerkoRefundId` is what a refund to the card will need.
    await updateAttempt({
      trace: {
        transactionId: attemptId,
        failureReason: null,
        qerkoRefundId: optionalNonEmptyString255(operation.refundId),
        authorizationCode: optionalNonEmptyString255(
          operation.authorizationCode
        ),
        cardBrand: optionalNonEmptyString255(operation.cardBrand),
        maskedPan: optionalNonEmptyString255(operation.maskedPan),
        entryMode: operation.entryMode,
        sequenceNumber: optionalNonEmptyString255(operation.sequenceNumber),
        merchantId: optionalNonEmptyString255(operation.merchantId),
        terminalDateTime: optionalNonEmptyString255(operation.terminalDateTime),
        chargedTipAmount: NonNegativeInteger(operation.chargedTipAmount),
      },
    })

    return ok({ status: "paid" })
  }

/**
 * Starts a card payment on the terminal this device chose.
 *
 * Refuses before the terminal is asked when the payment can no longer take
 * money, or while an earlier attempt is still running or unresolved — the
 * latter needs `retryUnresolved`, the caller's confirmation that staff have
 * checked the terminal (payment/0006).
 *
 * The attempt's UUID is stored as pending *before* the request leaves, so a
 * crash or a dropped response still leaves something for
 * `syncQerkoTerminalPayment` to ask Qerko about. A network failure therefore
 * leaves the attempt pending; a refusal to start clears it, except an
 * upstream timeout, which may or may not have reached the terminal and so
 * becomes unresolved.
 */
export const startQerkoTerminalPayment =
  ({
    paymentId,
    accountId,
    terminalId,
    terminalTid,
    deviceId,
    retryUnresolved = false,
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly terminalId: NonEmptyString255Value
    readonly terminalTid?: NonEmptyString255Value
    readonly deviceId?: DeviceId | null
    readonly retryUnresolved?: boolean
  }): Task<
    QerkoTerminalPaymentProgress,
    StartQerkoTerminalPaymentError,
    QerkoPaymentDeps & UuidDep
  > =>
  async (run) => {
    const { evoluOwner } = run.deps
    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult
    const payment = paymentResult.value

    const accountResult = loadAccountWithCurrencyCheck({
      rows: await run.deps.evolu.loadQuery(
        qerkoTerminalAccountByIdQuery(accountId)
      ),
      notFoundError: createQerkoTerminalAccountNotFoundError({ id: accountId }),
      accountKind: "qerkoTerminal",
      accountId,
      expectedCurrency: payment.currency,
    })
    if (!accountResult.ok) return accountResult

    const payable = await run(requirePayablePayment(payment))
    if (!payable.ok) return payable

    const credentials = await run(loadQerkoCredentials("terminalPayments"))
    if (!credentials.ok) return credentials

    const [[row], [paymentNumber]] = await Promise.all([
      run.deps.evolu.loadQuery(paymentQerkoTerminalByIdQuery(paymentId)),
      run.deps.evolu.loadQuery(paymentNumberByPaymentIdQuery(paymentId)),
    ])

    const running = row?.pendingTransactionId
    if (running !== null && running !== undefined) {
      return err(
        createQerkoAttemptUnresolvedError({
          id: paymentId,
          transactionId: running,
        })
      )
    }
    const unresolved = row?.unresolvedTransactionId
    if (unresolved !== null && unresolved !== undefined && !retryUnresolved) {
      return err(
        createQerkoAttemptUnresolvedError({
          id: paymentId,
          transactionId: unresolved,
        })
      )
    }

    const transactionId = NonEmptyString255(run.deps.uuid.create())
    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "paymentQerkoTerminal",
        {
          id: paymentId,
          accountId,
          transactionId,
          pendingTransactionId: transactionId,
          pendingSince: TimestampMsSchema.decode(run.deps.date.now().getTime()),
          failureReason: null,
          // Staff confirmed the retry, so the old attempt no longer blocks.
          unresolvedTransactionId: null,
          terminalId,
          terminalTid: terminalTid ?? null,
        },
        { ...options, owner: evoluOwner }
      )
    )

    const created = await run(
      createQerkoTerminalPayment({
        credentials: credentials.value,
        terminalId,
        transactionId,
        // Qerko takes the total including the tip, and the tip on its own.
        amount: payment.amount,
        tipAmount: payment.tipAmount,
        currency: payment.currency,
        ...(paymentNumber === undefined
          ? {}
          : {
              referenceId: createVariableSymbolFromSerialNumber(
                paymentNumber.serialNumber
              ),
            }),
      })
    )
    // A failed request leaves the attempt pending on purpose: it may have
    // reached the terminal, and the next poll finds out.
    if (!created.ok) return created

    if (created.value.type === "notStarted") {
      const { reason } = created.value
      await runMutationWithCompletion((options) =>
        run.deps.evolu.update(
          "paymentQerkoTerminal",
          {
            id: paymentId,
            pendingTransactionId: null,
            pendingSince: null,
            ...(reason === "upstreamTimeout"
              ? { unresolvedTransactionId: transactionId }
              : {}),
          },
          { ...options, owner: evoluOwner }
        )
      )
      return err(createQerkoTerminalNotStartedError({ id: paymentId, reason }))
    }

    return run(
      applyQerkoPayment({
        paymentId,
        accountId,
        deviceId,
        attemptId: transactionId,
        operation: created.value.operation,
      })
    )
  }

/**
 * One poll of the attempt a payment has pending, settling it when Qerko has a
 * final answer. Safe to call from anywhere and as often as wanted — the
 * payment screen and the background job both do — because every write is
 * keyed on the attempt and the account transaction on the payment.
 */
export const syncQerkoTerminalPayment =
  ({
    paymentId,
    deviceId,
  }: {
    readonly paymentId: PaymentId
    readonly deviceId?: DeviceId | null
  }): Task<
    QerkoTerminalPaymentProgress,
    SyncQerkoTerminalPaymentError,
    QerkoPaymentDeps
  > =>
  async (run) => {
    const { evoluOwner } = run.deps
    const [row] = await run.deps.evolu.loadQuery(
      paymentQerkoTerminalByIdQuery(paymentId)
    )
    const attemptId = row?.pendingTransactionId
    if (row === undefined || attemptId === null || attemptId === undefined) {
      return ok({ status: "idle" })
    }

    const credentials = await run(loadQerkoCredentials("terminalPayments"))
    if (!credentials.ok) return credentials

    const polled = await run(
      getQerkoTerminalPaymentStatus({
        credentials: credentials.value,
        transactionId: attemptId,
      })
    )
    if (!polled.ok) return polled

    if (polled.value.type === "unknownTransaction") {
      const age =
        row.pendingSince === null
          ? Number.POSITIVE_INFINITY
          : run.deps.date.now().getTime() - row.pendingSince
      if (age < qerkoUnknownAttemptGraceMs) {
        // The starting device's request may still be on its way.
        return ok({ status: "pending", step: "connecting" })
      }
      // Qerko never saw the attempt (the request did not get through), so no
      // money moved: the attempt ends and the payment can be tried again.
      await runMutationWithCompletion((options) =>
        run.deps.evolu.update(
          "paymentQerkoTerminal",
          { id: paymentId, pendingTransactionId: null, pendingSince: null },
          { ...options, owner: evoluOwner }
        )
      )
      return ok({ status: "idle" })
    }

    return run(
      applyQerkoPayment({
        paymentId,
        accountId: row.accountId,
        deviceId,
        attemptId,
        operation: polled.value.operation,
      })
    )
  }

/**
 * Asks Qerko to cancel the payment waiting on the terminal. Only a request:
 * the outcome — cancelled, or approved after all — is read by the next
 * `syncQerkoTerminalPayment`.
 */
export const cancelQerkoTerminalPayment =
  (
    paymentId: PaymentId
  ): Task<
    QerkoCancelResult,
    QerkoPluginNotPairedError | QerkoClientError,
    EvoluDep & QerkoApiDep & FetchDep
  > =>
  async (run) => {
    const [row] = await run.deps.evolu.loadQuery(
      paymentQerkoTerminalByIdQuery(paymentId)
    )
    const attemptId = row?.pendingTransactionId
    if (attemptId === null || attemptId === undefined) {
      return ok("unknownTransaction")
    }

    const credentials = await run(loadQerkoCredentials("terminalPayments"))
    if (!credentials.ok) return credentials

    return run(
      cancelQerkoTerminalPaymentRequest({
        credentials: credentials.value,
        transactionId: attemptId,
      })
    )
  }
