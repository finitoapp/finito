/**
 * The read-and-validate half of the payment module, as `bill-guards.ts` is for
 * bills: what state a payment is in and whether the caller may act on it,
 * without writing anything. `payment-actions.ts` and `refund-actions.ts`
 * compose these, so every guard reads "has money arrived" the same way.
 */

import { err, ok, type Result, type Task } from "@evolu/common"

import type { DateDep } from "../../deps.ts"
import type { AccountId } from "../account/account-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { getFirstOr } from "../shared/result.ts"
import type { FiatCurrency } from "../shared/schema.ts"
import type { PaymentRow } from "./payment.ts"
import {
  type AccountCurrencyMismatchError,
  createAccountCurrencyMismatchError,
  createPaymentNotPayableError,
  type PaymentNotPayableError,
} from "./payment-errors.ts"
import {
  paymentCardSwitchioByIdQuery,
  paymentCashuReceiveQuery,
  paymentClaimsQuery,
  paymentQerkoTerminalByIdQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "./payment-queries.ts"
import { derivePaymentStatus } from "./payment-status-utils.ts"
import type {
  PaymentAccountKind,
  PaymentId,
  PaymentStatus,
} from "./payment-types.ts"

/**
 * Whether money arrived for this payment. Read through `paymentClaimsQuery`,
 * which skips a claim whose transaction was deleted: counting it here made
 * `cancelPayment` refuse a payment every screen showed as pending, leaving its
 * bill locked with no way out.
 */
export const loadPaymentHasActiveClaim =
  (paymentId: PaymentId): Task<boolean, never, EvoluDep> =>
  async (run) =>
    ok(
      (await run.deps.evolu.loadQuery(paymentClaimsQuery(paymentId))).length > 0
    )

/** The payment's derived status (docs/bill-payment-states.md). */
export const loadPaymentStatus =
  (
    payment: Pick<
      PaymentRow,
      "id" | "canceledAt" | "confirmedPaidAt" | "expiresAt"
    >
  ): Task<PaymentStatus, never, EvoluDep & DateDep> =>
  async (run) => {
    const hasActiveClaim = await run.ok(loadPaymentHasActiveClaim(payment.id))
    return ok(
      derivePaymentStatus({
        canceledAt: payment.canceledAt,
        confirmedPaidAt: payment.confirmedPaidAt,
        expiresAt: payment.expiresAt,
        hasActiveClaim,
        now: run.deps.date.now(),
      })
    )
  }

/**
 * Whether money may be on its way to this payment without a claim yet: a
 * card attempt on SwitchioPay's or Qerko's terminal that has no definite
 * outcome, a Qerko payment in progress, or a Cashu token being received.
 */
export const loadPaymentHasOpenAttempt =
  (paymentId: PaymentId): Task<boolean, never, EvoluDep> =>
  async (run) => {
    const { evolu } = run.deps
    const [[card], [terminal], qerkoAttempts, [cashu]] = await Promise.all([
      evolu.loadQuery(paymentCardSwitchioByIdQuery(paymentId)),
      evolu.loadQuery(paymentQerkoTerminalByIdQuery(paymentId)),
      evolu.loadQuery(qerkoPaymentAttemptsByPaymentIdQuery(paymentId)),
      evolu.loadQuery(paymentCashuReceiveQuery(paymentId)),
    ])
    return ok(
      (card?.unresolvedTransactionId ?? null) !== null ||
        (terminal?.pendingTransactionId ?? null) !== null ||
        (terminal?.unresolvedTransactionId ?? null) !== null ||
        qerkoAttempts.some((attempt) => attempt.closedAt === null) ||
        (cashu?.receiveOperationId ?? null) !== null
    )
  }

/** Refuses a payment that is no longer waiting for money. */
export const requirePayablePayment =
  (
    payment: Pick<
      PaymentRow,
      "id" | "canceledAt" | "confirmedPaidAt" | "expiresAt"
    >
  ): Task<void, PaymentNotPayableError, EvoluDep & DateDep> =>
  async (run) => {
    const status = await run.ok(loadPaymentStatus(payment))
    if (status !== "pending") {
      return err(createPaymentNotPayableError({ id: payment.id, status }))
    }
    return ok()
  }

/**
 * Shared "load the first row or fail, then check its currency matches" step
 * behind both `preparePaymentMethod`'s cash-register/IBAN branches and
 * `markPaymentPaidCash`.
 */
export const loadAccountWithCurrencyCheck = <
  TRow extends { readonly currency: FiatCurrency },
  TNotFoundError,
>({
  rows,
  notFoundError,
  accountKind,
  accountId,
  expectedCurrency,
}: {
  readonly rows: ReadonlyArray<TRow>
  readonly notFoundError: TNotFoundError
  readonly accountKind: PaymentAccountKind
  readonly accountId: AccountId
  readonly expectedCurrency: FiatCurrency
}): Result<TRow, TNotFoundError | AccountCurrencyMismatchError> => {
  const accountResult = getFirstOr(rows, notFoundError)
  if (!accountResult.ok) return accountResult

  const account = accountResult.value
  if (account.currency !== expectedCurrency) {
    return err(
      createAccountCurrencyMismatchError({
        accountKind,
        id: accountId,
        accountCurrency: account.currency,
        paymentCurrency: expectedCurrency,
      })
    )
  }

  return ok(account)
}
