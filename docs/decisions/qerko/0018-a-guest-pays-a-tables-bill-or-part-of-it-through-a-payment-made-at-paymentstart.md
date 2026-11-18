# 0018 A guest pays a table's bill, or part of it, through a payment made at paymentStart

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

Payky's bill knows how much its payments paid (coverage,
`docs/bill-payment-states.md`) but not which lines: a split payment at the
till pays an amount. PR #220 (table self-pay) adds per-line allocations of
guests' payments (`selfPayAllocation`) and has "Pay" offer what is left of a
bill (table-self-pay/0002); it is not merged.

Qerko asks the POS to make sure every item paid is still on the bill, to
lock the related items or the whole bill while the guest pays and to unlock
it on a timeout, and waits 15 s for `paymentStart`.

## Decision

- A table's bill offers what is left to pay of it. Its id is the bill's;
  `allowTip` true, `denyDiscounts` and `denyMenus` true.
  - While every payment that reached the bill came through this flow, it
    offers the lines not yet paid, each with the quantity and amount left of
    it, priced and named as a payment's lines are (`qerko/0014`). Each Qerko
    payment records the lines it paid on its attempt (`paidLines`: line,
    quantity, amount charged); an attempt in progress counts too, a failed
    one does not.
  - Such a bill is paid in part (`allowPartialPayment` true): any of its
    lines, and part of a line of a whole quantity one at a time
    (`minQuantity` `"1"`). A line of a quantity that is not whole goes as
    one at its total (`qerko/0014`) and is paid whole (`minQuantity` `"0"`).
  - A bill with a discount line is paid whole: a guest could pay the goods
    and leave the discount, a line below zero, to whoever pays last.
  - Once money Payky cannot tie to lines reached the bill — a split at the
    till, a direct payment, a self-pay — it offers one item, "Zbývá
    zaplatit", with the bill's total less what its payments paid, paid
    whole.
  - A bill with nothing left, or whose goods come to nothing
    (`payment/0012`), is not offered: `getBill` answers `BILL_CLOSED`, as
    for a closed or discarded bill.
- `paymentStart` checks again and refuses:
  - `BILL_NOT_FOUND` for no such bill;
  - `BILL_CLOSED` for one closed, discarded or with nothing left;
  - `BILL_LOCKED` while any payment of the bill is pending
    (`requireEditableBill`), a staff Charge or another guest's Qerko payment:
    the whole bill is locked while one guest pays, as Qerko allows;
  - `INVALID_DATA` unless the currency matches, there is no discount and
    every item is a line still offered, once, at most what is left of it: a
    line paid whole at what is left of it, part of one at its share of that
    within one minor unit of Qerko's rounding, a bill paid whole with every
    line, the rest as its one item. A bill changed since Qerko read it is
    refreshed this way.
- The connection answers `paymentStart` calls one at a time, in the order
  Qerko made them, while every other call is answered as it comes: the
  check that nothing else pays the bill and the payment it then writes must
  not interleave with another start's, or two guests pressing Pay at once
  would both pass it and both be charged. Direct payments' running-attempt
  check is held the same way.
- Then it makes a payment of the bill for what the items add up to, tip
  zero, prepared for Qerko payments, its id derived from Qerko's payment id,
  and records the attempt on it, with the lines it pays, as a direct one's
  (`qerko/0013`). The payment is pending, so the bill's editing lock holds
  while the guest pays: staff cannot change it and another guest is told
  `BILL_LOCKED`.
- The receipt lists the lines paid at what Qerko charged for them, its VAT
  their recap (`qerko/0014`); the rest paid as one item is one line with the
  bill's VAT prorated, as any payment of part of a bill. The settling is a
  Qerko payment's (`qerko/0015`): `PAID` records the money, the guest's
  Qerko tip replacing the payment's zero, and the claim closes the bill once
  covered; a part payment leaves it open for the next guest. Money above
  what the items cost without a tip reads as an overpaid bill. Any other
  final state closes the attempt as failed, gives its lines back and
  cancels the payment, which unlocks the bill; a payment already paid
  another way stays. `get-payment` after the grace period (`qerko/0012`) is
  the timeout that unlocks a bill whose `paymentClosed` never came.
- No write may leave the lock without a way out:
  - A start interrupted between its payment and its attempt is finished by
    Qerko's next `paymentStart` of that payment: the payment its id derives
    from is this start's own, so its attempt is recorded rather than refused
    as locked, with the lines it pays read again from the bill its own lock
    kept still. A payment staff canceled meanwhile is `BILL_CLOSED`.
  - A failed attempt cancels its payment before it is closed, so an attempt
    still open sends `get-payment` back to finish it, and every settling of
    a failed attempt cancels a payment not canceled yet, whatever the
    attempt says, unless Qerko said `PAID`.

## Alternatives considered

- Paying a table's bill only whole, an earlier version of this record: a
  table of several guests could not each pay their own.
- Waiting for PR #220's `selfPayAllocation` to record which lines were
  paid: Qerko needs it now. `paidLines` stays on the Qerko attempt, written
  once with its start like the attempt's other columns (`qerko/0013`); the
  two may be joined once #220 lands, and until then money from the other
  flow makes the bill offer its rest whole.
- Locking only the lines being paid: two guests paying different lines at
  once would each need the other's payment out of the bill's editing lock,
  which judges the whole bill. Qerko allows the whole bill to be locked;
  the next guest pays once the first is done.
- Splitting a bill with a discount by spreading the discount over the
  lines: their prices would no longer match the menu (`qerko/0014`), and
  the shares would move as lines are paid.
- Recording the payment only at `PAID`, as PR #220's self-pay does: nothing
  would lock the bill while the guest pays, against Qerko's advice.
- Keeping a failed table payment for the next try, as a direct one is kept:
  it was made for one Qerko payment and would lock the bill until canceled.

## Consequences

Every failed Qerko attempt on a table leaves a canceled payment with its
number in the history, and each part payment is a payment of its own. A
bill paid partly at the till shows the guest one item with the rest. The
bill detail shows a part payment as an underpaid bill; which lines a guest
paid is on the payment's receipt in Qerko, not yet on Payky's screens.
Staff who cancel a table's payment while the guest pays get the
canceled-and-paid collision if Qerko then says `PAID`, resolved as any
other (`docs/bill-payment-states.md`). Like every lock here it holds on the
device that judged it, and only one device holds the connection
(`qerko/0011`): another device editing the bill offline shows as a coverage
mismatch after sync.

## Enforced by

- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers an unpaid bill's lines, goods before the discount; a bill with a discount is paid whole`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers what is left of each line once Qerko paid part of it`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > leaves out what an attempt in progress is paying`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers the rest as one amount once money not tied to lines paid part of it`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > deriveQerkoTableOffer > offers nothing for %s`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > createQerkoTableBill > lets the guest pay part of a splittable bill, a whole quantity at a time`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > createQerkoTableBill > a bill with a discount, or its rest, is paid whole, and a label names it`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > pays part of a bill: some lines, part of a line within Qerko's rounding`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > pays a fractional line only whole, at its total`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses %s`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses part of a bill that is not splittable`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > pays the rest as its one item`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > checkQerkoTablePaymentStart > refuses another currency or a discount`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > applyQerkoPaidLines > keeps the frozen lines paid, at what Qerko charged, in their order`
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
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > guests pay a bill in parts, each one what is still left of it`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > a failed part payment gives its lines back to the bill`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > a bill with a discount is paid whole`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paying part of a table's bill > after money the lines cannot account for, the rest is paid whole`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > PAID records the money and closes the bill, the guest's tip apart`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > PAID of what was left closes a bill partly paid at the till`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > money above the bill and no tip reads as an overpaid bill`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > %s cancels the table's payment and frees the bill for the next guest`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a failed attempt whose cancel never landed cancels its payment when Qerko says so again`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a canceled payment whose attempt stayed open is closed by the next settling, its cancellation kept`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > a late CANCELLED does not undo PAID nor cancel the paid payment`
- `packages/core/src/integrations/qerko/qerko-rpc.test.ts > createQerkoRpcSession > answers paymentStart one at a time, and nothing else waits for it`
