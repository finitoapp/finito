# 0018 A guest pays a table's bill whole, through a payment made at paymentStart

Status: accepted
Date: 2026-11-18

## Context

A table's bill exists before anyone pays it, unlike a direct Qerko payment,
which is a Payky payment from the start (`qerko/0014`). Qerko lets a guest
pay a subset of a bill's items unless `allowPartialPayment` is false, and
then expects the next guest to see only the items still unpaid. Payky's
bill knows how much its payments paid (coverage, `docs/bill-payment-states.md`)
but not which lines: a split payment at the till pays an amount. PR #220
(table self-pay) adds per-line allocations of guests' payments
(`selfPayAllocation`) and has "Pay" offer what is left of a bill
(table-self-pay/0002); it is not merged.

Qerko asks the POS to make sure every item paid is still on the bill, to
lock the bill while the guest pays and to unlock it on a timeout, and waits
15 s for `paymentStart`.

## Decision

- A table's bill is offered whole: `allowPartialPayment` false, each item's
  `minQuantity` `"0"`, `allowTip` true, `denyDiscounts` and `denyMenus` true.
  Its id is the bill's.
- It offers what is left to pay of it: its total less what its payments
  have paid, their tips left out. While nothing is paid that is the bill's
  lines, priced and named as a payment's are (`qerko/0014`); once part is
  paid it is one item, "Zbývá zaplatit", with the rest, since Payky does not
  know which lines the money paid. A bill with nothing left, or whose goods
  come to nothing (`payment/0012`), is not offered: `getBill` answers
  `BILL_CLOSED`, as for a closed or discarded bill.
- `paymentStart` checks again and refuses:
  - `BILL_NOT_FOUND` for no such bill;
  - `BILL_CLOSED` for one closed, discarded or with nothing left;
  - `BILL_LOCKED` while any payment of the bill is pending
    (`requireEditableBill`), a staff Charge or another guest's Qerko payment;
  - `INVALID_DATA` unless the currency matches, there is no discount and the
    items are exactly those offered now, each by id and price. A bill
    changed since Qerko read it is refreshed this way.
- The connection answers `paymentStart` calls one at a time, in the order
  Qerko made them, while every other call is answered as it comes: the
  check that nothing else pays the bill and the payment it then writes must
  not interleave with another start's, or two guests pressing Pay at once
  would both pass it and both be charged. Direct payments' running-attempt
  check is held the same way.
- Then it makes a payment of the bill for what is left, tip zero, prepared
  for Qerko payments, its id derived from Qerko's payment id, and records the
  attempt on it as a direct one's (`qerko/0013`). The payment is pending, so
  the bill's editing lock holds while the guest pays: staff cannot change
  it and another guest is told `BILL_LOCKED`.
- The receipt and the settling are a Qerko payment's (`qerko/0014`,
  `qerko/0015`): `PAID` records the money, the guest's Qerko tip replacing
  the payment's zero, and the claim closes the bill once covered. Money above
  the bill without a tip reads as an overpaid bill. Any other final state
  closes the attempt as failed and cancels the payment, which unlocks the
  bill for the next guest; a payment already paid another way stays.
  `get-payment` after the grace period (`qerko/0012`) is the timeout that
  unlocks a bill whose `paymentClosed` never came.
- No write may leave the lock without a way out:
  - A start interrupted between its payment and its attempt is finished by
    Qerko's next `paymentStart` of that payment: the payment its id derives
    from is this start's own, so its attempt is recorded rather than refused
    as locked. A payment staff canceled meanwhile is `BILL_CLOSED`.
  - A failed attempt cancels its payment before it is closed, so an attempt
    still open sends `get-payment` back to finish it, and every settling of
    a failed attempt cancels a payment not canceled yet, whatever the
    attempt says, unless Qerko said `PAID`.

## Alternatives considered

- Letting guests pay a subset of items (`allowPartialPayment` true): the next
  guest must see only what is unpaid, which needs per-line paid shares. A
  Qerko-only allocation would duplicate PR #220's `selfPayAllocation`;
  splitting by items should follow once that lands, sharing it. Until then a
  table splits at the till, and Qerko takes the rest. To be confirmed by
  product.
- Recording the payment only at `PAID`, as PR #220's self-pay does: nothing
  would lock the bill while the guest pays, against Qerko's advice, and staff
  could change it under the guest.
- Locking with a column on the bill: a lock nothing derives must be cleared
  by hand when a write is lost; the pending payment clears itself.
- Keeping a failed table payment for the next try, as a direct one is kept:
  it was made for one Qerko payment and would lock the bill until canceled.

## Consequences

Every failed Qerko attempt on a table leaves a canceled payment with its
number in the history. A bill paid partly at the till shows the guest one
line with the rest, and its receipt is the payment's one line with prorated
VAT (`qerko/0014`). Staff who cancel a table's payment while the guest pays
get the canceled-and-paid collision if Qerko then says `PAID`, resolved as
any other (`docs/bill-payment-states.md`). Like every lock here it holds on
the device that judged it, and only one device holds the connection
(`qerko/0011`): another device editing the bill offline shows as
a coverage mismatch after sync.

## Enforced by

- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers an unpaid bill's lines, goods before the discount, adding up to the bill`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers a partly paid bill's rest as one amount`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers nothing for %s`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > createQerkoTableBill > names the bill by its label or number and prices each line at its total`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > accepts the items offered, in any order, with a tip in none of them`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses another item of the same price`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses an item at another price`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getTableContents > a bill partly paid offers only what is left, as one item`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getBill > answers a table's bill by its id, as getTableContents lists it`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getBill > answers %s with BILL_NOT_FOUND`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getBill > answers a discarded bill or one with nothing to pay with BILL_CLOSED`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > makes a pending payment of the bill through Qerko, which locks the bill`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > records the start once, however often Qerko repeats it`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses %s as INVALID_DATA`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses a bill that changed since Qerko read it, and accepts it read again`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses a bill another payment locks with BILL_LOCKED`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > two guests starting to pay one bill at once: one pays, the other is told BILL_LOCKED`
- `packages/core/src/integrations/qerko/qerko-rpc.test.ts > createQerkoRpcSession > answers paymentStart one at a time, and nothing else waits for it`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > PAID records the money and closes the bill, the guest's tip apart`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > PAID of what was left closes a bill partly paid at the till`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > money above the bill and no tip reads as an overpaid bill`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > %s cancels the table's payment and frees the bill for the next guest`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a late CANCELLED does not undo PAID nor cancel the paid payment`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > finishes a start whose payment was made but whose attempt was never recorded`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses a start whose payment staff canceled before its attempt was recorded`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a failed attempt whose cancel never landed cancels its payment when Qerko says so again`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a canceled payment whose attempt stayed open is closed by the next settling, its cancellation kept`
