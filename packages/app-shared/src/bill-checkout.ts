import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  derivePaymentMethodsOffered,
  type PaymentMethodAccount,
} from "@payky/core/modules/account/account-utils"
import type {
  AddBillLineError,
  CloseZeroBillError,
} from "@payky/core/modules/bill/bill-actions"
import {
  deriveZeroBillRefusal,
  isPayableThroughAnyMethod,
} from "@payky/core/modules/bill/bill-utils"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import { deriveBillGoodsTotal } from "@payky/core/modules/bill-line/bill-line-utils"
import type {
  CreatePreparedPaymentError,
  MarkPaymentPaidCashError,
} from "@payky/core/modules/payment/payment-errors"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"

/**
 * What the cart's main button does with the bill as it stands:
 *
 * - `charge`: Charge, which creates a payment.
 * - `finish`: Finish in Charge's place — the bill's goods come to exactly
 *   zero, so no payment can settle it and staff close it without one
 *   (`closeZeroBill`, payment/0013).
 * - `empty`: nothing on the bill yet; Charge stays, disabled.
 * - `negative`: the goods come to less than zero; Charge stays, disabled,
 *   and the bill can only be discarded.
 * - `notPayable`: goods of zero beside a tip line, which neither a payment
 *   (`BillTotalNotPositive`, payment/0012) nor Finish (payment/0013) takes;
 *   Charge stays, disabled, until the tip is removed.
 * - `noPayableMethod`: goods above zero that none of the payment methods
 *   turned on can take — a cash-only shop and a bill cash rounds to nothing;
 *   Charge stays, disabled, as `createPayment` would refuse the payment
 *   (`NoPayableMethod`).
 */
export type BillCheckout =
  | "charge"
  | "finish"
  | "empty"
  | "negative"
  | "notPayable"
  | "noPayableMethod"

/**
 * Decides the cart's main button from the same rules the core enforces
 * (`deriveZeroBillRefusal` behind `closeZeroBill`; goods above zero and
 * `isPayableThroughAnyMethod` behind `createPayment`), so both apps offer
 * exactly what the core will take.
 *
 * `paymentAccounts` are the payment accounts turned on
 * (`enabledPaymentMethodAccountsQuery`); the payment will offer those in the
 * bill's currency that the payment screen shows a tab for
 * (`derivePaymentMethodsOffered`, payment/0017), which is what the core
 * judges too: `cardTerminalLinked` and `qerkoRestaurantPaired` are the same
 * checks the payment screen makes. Only cash rounds, so this refuses goods
 * above zero only in a shop whose one method shown is cash. With no method
 * turned on the goods are judged as they stand, and the payment screen says
 * what is missing.
 */
export const deriveBillCheckout = ({
  summaries,
  currency,
  paymentAccounts,
  cardTerminalLinked,
  qerkoRestaurantPaired,
}: {
  readonly summaries: ReadonlyArray<BillLineSummary>
  readonly currency: FiatCurrency
  readonly paymentAccounts: ReadonlyArray<PaymentMethodAccount>
  readonly cardTerminalLinked: boolean
  readonly qerkoRestaurantPaired: boolean
}): BillCheckout => {
  if (summaries.length === 0) return "empty"
  if (deriveZeroBillRefusal(summaries) === null) return "finish"

  const goodsTotal = deriveBillGoodsTotal(summaries)
  if (goodsTotal < 0) return "negative"
  if (goodsTotal === 0) return "notPayable"
  const methods = derivePaymentMethodsOffered({
    accounts: paymentAccounts,
    currency,
    cardTerminalLinked,
    qerkoRestaurantPaired,
  })
  return isPayableThroughAnyMethod({ goodsTotal, currency, methods })
    ? "charge"
    : "noPayableMethod"
}

/**
 * The hint under the cart's main button for each checkout, saying why
 * Charge is disabled; `null` where nothing needs explaining.
 */
export const billCheckoutHintKeys = {
  charge: null,
  finish: null,
  empty: null,
  negative: "bill.negativeTotal",
  notPayable: "bill.notPayable",
  noPayableMethod: "bill.noPayableMethod",
} satisfies Record<BillCheckout, TranslationKey | null>

/** The toast each refusal of `createPreparedPayment` shows on Charge. */
export const createPaymentErrorKeys = {
  AccountSparkNotFound: "payment.create.error",
  ZeroAmountNotPayable: "payment.create.error",
  PaymentPreparationFailed: "payment.create.error",
  YadioHttpError: "payment.create.error",
  YadioApiError: "payment.create.error",
  FetchError: "payment.create.error",
  BillNotFound: "payment.create.error",
  BillStatusNotAllowed: "payment.create.error",
  BillTotalNotPositive: "payment.create.billTotalNotPositive",
  NoPayableMethod: "payment.create.noPayableMethod",
} satisfies Record<CreatePreparedPaymentError["type"], TranslationKey>

/**
 * What the payment screen says when Mark as paid in cash is refused. A
 * payment cash rounds to nothing (`CashAmountRoundsToZero`, payment/0012)
 * gets its own message, being one no retry fixes; the screen offers no cash
 * for it (`isCashPayable`), so it shows only where the payment changed
 * under the screen.
 */
export const markCashPaidErrorKeys = {
  PaymentNotFound: "paymentWait.cashPaid.error",
  PaymentCanceled: "paymentWait.cashPaid.error",
  CashAmountRoundsToZero: "paymentWait.cashPaid.notPayable",
  CashRegisterAccountNotFound: "paymentWait.cashPaid.error",
  AccountCurrencyMismatch: "paymentWait.cashPaid.error",
  CashReceivedBelowCharge: "paymentWait.cashPaid.error",
} satisfies Record<MarkPaymentPaidCashError["type"], TranslationKey>

/** The toast each refusal of `closeZeroBill` shows on Finish. */
export const closeZeroBillErrorKeys = {
  BillNotFound: "bill.finish.error",
  BillStatusNotAllowed: "bill.closed",
  BillLocked: "bill.locked",
  BillNotZero: "bill.finish.notZero",
} satisfies Record<CloseZeroBillError["type"], TranslationKey>

/**
 * The toast each refusal of a cart write shows — a tap on an item, a removed
 * line, clearing the cart, undo and redo. A pending payment gets its own
 * message, being routine rather than a failure, and so does a write that
 * would take a partly paid bill below what was paid (payment/0014), which
 * retrying cannot fix. An item that became a discount, or stopped being one,
 * since the screen showed it is refused before `discard` could be asked for
 * (access/0012); a retry judges it again on the fresh row. A removal the
 * line no longer holds — another device took it off meanwhile — says the
 * line changed.
 */
export const cartWriteErrorKeys = {
  CatalogItemNotFound: "app.saveFailed",
  CatalogItemPriceSignStale: "bill.itemPriceChanged",
  BillLineSummaryMissing: "app.saveFailed",
  BillNotFound: "app.saveFailed",
  BillStatusNotAllowed: "app.saveFailed",
  BillLocked: "bill.locked",
  BillTotalBelowPaid: "bill.totalBelowPaid",
  BillLineRemovalOutOfRange: "bill.lineChanged",
} satisfies Record<AddBillLineError["type"], TranslationKey>
