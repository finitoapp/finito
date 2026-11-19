# 0018 A guest pays a table's bill, or a part split off into a bill of its own

Status: accepted
Date: 2026-11-18

## Context

A table's bill exists before anyone pays it, unlike a direct Qerko payment,
which is a Payky payment from the start (`qerko/0014`). Qerko lets a guest
pay a subset of a bill's items, and part of an item's quantity in steps of
its `minQuantity`, unless `allowPartialPayment` is false; the next guest
then expects to see only what is still unpaid. Qerko returns in `Payment`
the items paid, by the ids the POS gave them, each with its quantity and
price.

A Payky payment is read best when it pays its bill whole: its receipt lists
the bill's lines with their exact VAT (`qerko/0014`) and the bill closes.
A payment of part of a bill knows how much it paid, not which lines.
Staff already split a bill at the till (`splitBillIntoNewBill`), moving a
selection of lines, or part of a line at an amount the caller gives, onto a
new bill; a split that empties the source cancels it, and no split may
leave a bill below zero. PR #220 (table self-pay) keeps one bill and marks
the lines guests paid (`selfPayAllocation`); it is not merged.

Qerko asks the POS to make sure every item paid is still on the bill, to
lock the related items or the whole bill while the guest pays and to unlock
it on a timeout, and waits 15 s for `paymentStart`.

## Decision

- A table's bill offers what is left to pay of it. Its id is the bill's;
  `allowTip` true, `denyDiscounts` and `denyMenus` true.
  - While nothing is paid of it, it offers its lines, priced and named as a
    payment's are (`qerko/0014`), and may be paid in part
    (`allowPartialPayment` true): any of its lines, and part of a line of a
    whole quantity one at a time (`minQuantity` `"1"`). A line of a
    quantity that is not whole goes as one at its total (`qerko/0014`) and
    is paid whole (`minQuantity` `"0"`).
  - A bill with a discount line is paid whole: no split may leave a bill
    below zero, and the guest could not tell which parts would.
  - Once part of it is paid — at the till, or by a direct payment — it
    offers one item, "Zbývá zaplatit", with its total less what its
    payments paid, paid whole.
  - A bill with nothing left, or whose goods come to nothing
    (`payment/0012`), is not offered: `getBill` answers `BILL_CLOSED`, as
    for a closed or discarded bill. `getTableContents` leaves out, too, a
    bill a payment is paying now; `getBill` answers it and `paymentStart`
    says `BILL_LOCKED`.
- `paymentStart` checks again and refuses:
  - `BILL_NOT_FOUND` for no such bill;
  - `BILL_CLOSED` for one closed, discarded or with nothing left;
  - `BILL_LOCKED` while any payment of the bill is pending
    (`requireEditableBill`), a staff Charge or a guest paying it whole;
  - `INVALID_DATA` unless the currency matches, there is no discount and
    every item is a line still on the bill, once, at most its quantity: a
    line paid whole at its total, part of one at its share of that within
    one minor unit of Qerko's rounding, a bill that is not splittable with
    every line, the rest as its one item, and a part with goods in it, not
    a tip line of the cart alone. A bill changed since Qerko read it is
    refreshed this way.
- A guest paying all of the bill pays the bill. A guest paying part of it
  has that part split off into a bill of its own on the same table
  (`splitBillIntoNewBill`), each line at the quantity and the amount Qerko
  charged, and pays that bill whole. Both the part's bill and its payment
  derive their ids from Qerko's payment id. The payment is for what the
  items cost, tip zero, prepared for Qerko payments, and its attempt is
  recorded as a direct one's (`qerko/0013`) with the bill the part came
  from (`splitFromBillId`). The payment is pending, so the editing lock
  holds the bill it pays: staff cannot change it and Qerko lists it no
  more. The rest of a split bill stays open and unlocked, so other guests
  pay their parts meanwhile.
- The device holding the connection answers `paymentStart` calls one at a
  time, in the order Qerko made them, across reconnections too — Qerko
  repeats an unanswered call on the next connection — while every other
  call is answered as it comes: the
  check that the bill holds what is paid and the split or payment written
  after it must not interleave with another start's, or two guests would
  both pay the same line. Direct payments' running-attempt check is held
  the same way.
- The receipt lists the paid bill's lines with their VAT (`qerko/0014`);
  the rest paid as one item is one line with the bill's VAT prorated, as
  any payment of part of a bill. The settling is a Qerko payment's
  (`qerko/0015`): `PAID` records the money, the guest's Qerko tip replacing
  the payment's zero, and closes the bill it paid. Money above what the
  items cost without a tip reads as an overpaid bill.
- Any other final state cancels the payment, which unlocks its bill, and
  moves a part's lines back to the bill they were split off from, which
  cancels the emptied part. Should that bill be closed or locked by then —
  another guest paying the rest of it — the part stays an open bill of its
  own on the table, which staff or a guest settle like any other. A payment
  already paid another way stays, and so do its lines. `get-payment` after
  the grace period (`qerko/0012`) is the timeout that unlocks a bill whose
  `paymentClosed` never came.
- No write may leave a lock without a way out:
  - A start interrupted after its split but before its payment is finished
    by Qerko's next `paymentStart` of that payment, which pays the part as
    it stands. One interrupted between the payment and its attempt records
    the attempt rather than being refused as locked by its own payment. A
    payment staff canceled meanwhile is `BILL_CLOSED`.
  - A failed attempt cancels its payment and moves the lines back before
    it is closed, so an attempt still open sends `get-payment` back to
    finish it, and every settling of a failed attempt cancels a payment not
    canceled yet, whatever the attempt says, unless Qerko said `PAID`. The
    lines are moved back only while the attempt is open, so a part left
    apart is never pulled back later, after staff may have changed it.

## Alternatives considered

- Paying a table's bill only whole, the first version of this record: a
  table of several guests could not each pay their own.
- Keeping one bill and recording the lines each Qerko payment paid on its
  attempt, the second version: the receipt had to rebuild the paid lines,
  Payky's screens could not show which lines a guest paid, the whole bill
  stayed locked while one guest paid, and money paid at the till left the
  bill offered as one amount. A split bill is an ordinary bill: paid whole,
  closed, listed in the history with its lines.
- Marking paid lines as PR #220 does (`selfPayAllocation`): it keeps the
  table on one bill, but its guests pay without the POS online and cannot
  be split off at the moment they pay; a Qerko guest can. The two flows
  then read differently in the history, a part paid through Qerko as a bill
  of its own. To be weighed again once #220 lands.
- Splitting at `PAID` instead of `paymentStart`: the payment has to be made
  at the start to hold the lock, and a payment cannot move onto another
  bill afterwards.
- Splitting a bill with a discount, the discount spread over the parts:
  their prices would no longer match the menu (`qerko/0014`).

## Consequences

Each guest paying part of a table's bill leaves a bill of their own with
its number, closed once paid, and a failed attempt a canceled payment; the
floor view shows the part as a bill on the table while it is being paid.
A bill paid partly at the till shows the guest one item with the rest. A
split moves its lines at once, so a part's receipt lists them in no fixed
order. Staff who cancel a table's payment while the guest pays get the
canceled-and-paid collision if Qerko then says `PAID`, resolved as any
other (`docs/bill-payment-states.md`). Like every lock here it holds on the
device that judged it, and only one device holds the connection
(`qerko/0011`): another device editing the bill offline shows as a
coverage mismatch after sync.

## Enforced by

- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers an unpaid bill's lines, goods before the discount; a bill with a discount is paid whole`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers the rest as one amount once part of the bill is paid`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers nothing for %s`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > createQerkoTableBill > lets the guest pay part of a splittable bill, a whole quantity at a time`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > createQerkoTableBill > a bill with a discount, or its rest, is paid whole, and a label names it`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > pays part of a bill: some lines, part of a line within Qerko's rounding`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > pays the whole bill as it is, splitting nothing off`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses a part that is only a tip of the cart`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > pays a fractional line only whole, at its total`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses %s`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses part of a bill that is not splittable`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > pays the rest as its one item`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses another currency or a discount`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getTableContents > a bill partly paid offers only what is left, as one item`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getBill > answers a table's bill by its id, as getTableContents lists it`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getBill > answers %s with BILL_NOT_FOUND`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getBill > answers a discarded bill or one with nothing to pay with BILL_CLOSED`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > makes a pending payment of the bill through Qerko, which locks the bill`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > records the start once, however often Qerko repeats it`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses %s as INVALID_DATA`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses a line another guest paid since Qerko read the bill, and accepts the bill read again`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses a bill another payment locks with BILL_LOCKED`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > two guests starting to pay one bill at once: one pays, the other is told BILL_LOCKED`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > finishes a start whose payment was made but whose attempt was never recorded`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses a start whose payment staff canceled before its attempt was recorded`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > a guest's part is split off into a bill of its own and paid whole, the rest left open for the others`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > a failed part payment gives its lines back to the bill`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > a failed part whose bill is being paid meanwhile stays a bill of its own`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > a part split off before an interruption is paid as it stands`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > a bill with a discount is paid whole`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > PAID records the money and closes the bill, the guest's tip apart`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > PAID of what was left closes a bill partly paid at the till`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > money above the bill and no tip reads as an overpaid bill`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > %s cancels the table's payment and frees the bill for the next guest`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a failed attempt whose cancel never landed cancels its payment when Qerko says so again`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a canceled payment whose attempt stayed open is closed by the next settling, its cancellation kept`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a late CANCELLED does not undo PAID nor cancel the paid payment`
- `packages/core/src/integrations/qerko/qerko-rpc.test.ts > createQerkoRpcSession > answers paymentStart one at a time, and nothing else waits for it`
- `packages/core/src/integrations/qerko/qerko-rpc.test.ts > createQerkoRpcSession > a start repeated on a new session waits for the one still running on the session before`
