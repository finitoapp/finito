# 0012 A payment is created only for goods worth more than zero

Status: accepted
Date: 2026-11-10

## Context

An item may cost nothing (catalog/0001), so a bill can add up to zero. Such a
bill used to close through a payment of zero: `createPayment` took it, cash
was confirmed for nothing, and the claim closed the bill (the "$0 claim for a
fully-discounted bill" `docs/bill-payment-states.md` described). That writes
a payment, a payment number and a sale of zero to EET, and two devices doing
it at once write two of each.

Cash rounds: a CZK cash total is rounded to the whole crown (payment/0002),
so a bill of 0.01–0.49 CZK comes to nothing in cash although a card would
charge it. A tip on the bill is gratuity, not what the bill is worth.

Both apps create a payment before a method is picked: one payment offers
every payment method turned on at once, and the next screen prepares the
one the customer picks. The rule cannot wait for that pick, and cash must
not take a payment it rounds to nothing once the pick is cash.

## Decision

Two rules, both held by the core.

- **At creation**, `createPayment` creates a payment only when its goods
  come to more than zero and at least one payment method the payment will
  offer can collect more than zero of them once it rounds them.
  - The goods are a bill's lines without its tip lines
    (`deriveBillGoodsTotal`), or a keypad payment's amount without its tip
    (`calculatePaymentBaseAmount`): a tip cannot lift goods that come to
    nothing into something that can be charged.
  - A bill whose goods do not come to more than zero is refused by
    `requireBillAcceptingPayment`, after its status, with
    `BillTotalNotPositive`. It reads the bill, not the payment's `amount`.
  - The methods a payment offers are the payment accounts turned on, in the
    payment's currency where the kind has one
    (`derivePaymentMethodsOffered`, the accounts the payment screen offers a
    tab for); a payment created with one method's details, as the CLI's
    `--cashRegisterAccountId` does, offers that one. Each is judged by
    `isBillPayable`, and only cash rounds (`roundCashAmount`), so goods
    above zero are refused, with `NoPayableMethod`, only where cash is the
    one method on and rounds them to nothing (`isPayableThroughAnyMethod`).
    With no method turned on nothing rounds, the goods are judged as they
    stand, and the payment screen says what is missing.
  - The card terminal, linked only into the native app, and Qerko payments,
    which need the restaurant their pairing names, are counted as offered
    only where the payment screen shows them, and the payment's own goods
    are judged besides a bill's (payment/0017).
  - Both apps' cart offers Charge by the same `isPayableThroughAnyMethod`
    over the same accounts (`deriveBillCheckout`), keeping it disabled, with
    a hint, where the core would refuse; the keypad shows the core's refusal
    (`createPaymentErrorKeys`).
- **At settlement**, `markPaymentPaidCash` refuses a payment whose goods —
  its amount without the tip — round to nothing in cash (`isCashPayable`),
  with `CashAmountRoundsToZero`. Such a payment was created because another
  method could take it. The payment screens offer no cash for it by the same
  `isCashPayable`, and the refusal holds the rule for the CLI, an older app
  and the test bridges. It judges the payment as created, never the bill as
  it stands later, so a bill another device lowers afterwards leaves its
  payment payable in cash, and the bill ends up closed and overpaid.
- `createPayment` is the only place a payment row is written, so every
  method and the CLI go through it, and a payment cannot be moved onto a
  bill afterwards (`updatePayment` takes no bill, `payments update` has no
  `--billId`). Nothing after creation judges the bill again: a Qerko
  `paymentStart`, a terminal's result and a claim do not, and a bill whose
  total drops to zero after its payment was created ends up closed and
  overpaid once the payment is settled, as when lines are taken off after a
  payment.
- Lightning's and Cashu's own refusal of a zero amount
  (`ZeroAmountNotPayable`) stays as a second line of defence, for a payment
  changed afterwards or written by an older app.

## Alternatives considered

A cash transaction of zero to close the bill, which depends on a cash account
that turning cash off soft-deletes, and writes a payment, a payment number
and a sale of zero to EET. A new kind of payment with a virtual account,
which breaks what an account means and needs exceptions across payment
methods, EET, refunds and statistics. Judging `payment.amount`, which the
caller chooses. Judging a payment created before a method is picked
unrounded and leaving cash to the payment screen alone, which let a
cash-only shop create a payment nobody could pay, and the CLI or an older
app settle in cash a payment cash rounds to nothing.

## Consequences

A bill that comes to exactly zero is finished without a payment
(payment/0013). The paragraph "Priority 3 requires an active claim" and the
"paid" row of the coverage table in `docs/bill-payment-states.md` no longer
mention a claim of zero, and its section "Creating a payment" states these
rules. A cash-only shop cannot charge 0.01–0.49 CZK at all.

## Enforced by

- `packages/core/src/modules/bill/bill-utils.test.ts > isBillPayable > a bill whose goods come to zero cannot be paid through any method`
- `packages/core/src/modules/bill/bill-utils.test.ts > isBillPayable > a CZK bill of 0.40 cannot be paid in cash but can by card`
- `packages/core/src/modules/bill/bill-utils.test.ts > isPayableThroughAnyMethod > refuses goods cash rounds to nothing where cash is the only method on`
- `packages/core/src/modules/bill/bill-utils.test.ts > isPayableThroughAnyMethod > takes goods cash rounds to nothing where a card or a QR method is on too`
- `packages/core/src/modules/bill/bill-utils.test.ts > isPayableThroughAnyMethod > refuses goods of zero or less whatever is on, and judges goods as they stand with nothing on`
- `packages/core/src/modules/account/account-utils.test.ts > derivePaymentMethodsOffered > offers each kind turned on once, in the payment's currency where the kind has one`
- `packages/core/src/modules/bill-line/bill-line-utils.test.ts > deriveBillGoodsTotal > adds up every line but the tips`
- `packages/core/src/modules/payment/payment-cash-utils.test.ts > isCashPayable > refuses cash for a CZK payment of 0.40, which cash rounds to nothing`
- `packages/core/src/modules/payment/payment-cash-utils.test.ts > isCashPayable > does not let a tip make cash take a payment whose goods come to nothing`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a bill whose goods come to zero cannot be paid through any method, and is finished instead`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a CZK bill of 0.40 cannot be paid in cash, but can by card`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a payment cash rounds to nothing is not created where cash is the only method turned on, bill or keypad`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a payment cash rounds to nothing is created where a card or a QR method is turned on too, bill or keypad`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a tip does not lift a bill whose goods come to zero into one that can be paid`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a bill with a free item and a positive total is paid as any other`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > cash that rounds to nothing > markPaymentPaidCash refuses a CZK payment of 0.40 and settles one of 0.50`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > cash that rounds to nothing > markPaymentPaidCash does not let a tip lift goods cash rounds to nothing`
- `packages/app-shared/src/bill-checkout.test.ts > deriveBillCheckout > charges a bill with a free item and a positive total, and a bill too small for cash`
- `packages/app-shared/src/bill-checkout.test.ts > deriveBillCheckout > keeps Charge disabled, with a hint, where no payment method turned on can take the bill`
- `packages/app-shared/src/bill-checkout.test.ts > markCashPaidErrorKeys > says why cash cannot settle a payment it rounds to nothing, rather than to try again`
- `apps/web-app/e2e/activity-bills.spec.ts > the bills list and detail page show an overpaid bill when another device shrank the total while the payment was in flight`
