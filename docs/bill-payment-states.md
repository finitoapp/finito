# Bill and payment states

This document specifies the intended lifecycle of a `bill` and of a
`payment`, and how the two combine. It is the source of truth for *why* the
states are shaped this way, not just what the code currently does — read it
before changing the bill's derived status, the editing lock,
`payment.canceledAt`/`confirmedPaidAt`/`expiresAt`, `bill.canceledAt`/
`confirmedClosedAt`/`closedAt`, or any of the guards in `bill-actions.ts` /
`payment-actions.ts` / `reconciliation-claim-actions.ts`.

## Two independent verticals

A bill (the tab: line items, table, total) and a payment (one attempt to
collect money for a bill) are deliberately modeled as **two independent
state machines**, not one combined lifecycle:

- A bill can have zero, one, or many payments over its life (retries after a
  failed attempt, or several payments splitting one bill).
- A payment's own outcome (paid, canceled, expired) is meaningful on its own
  — e.g. for payment history — independently of what the bill it belongs to
  is doing.

They are read together to derive two extra facts: whether a bill is
currently **locked** for editing (a live payment is in flight — see
["Editing lock"](#editing-lock)), and whether a bill's total has been
**covered** by money that actually arrived (see
["Bill payment coverage"](#bill-payment-coverage)). Everything else about
each vertical is decided on its own.

Neither vertical stores its display status as a mutable field with guarded
transitions. Both instead store only the small set of facts that can't be
derived from anything else (an explicit cancellation, an explicit staff
override) and compute everything else — `PaymentStatus`, `BillStatus`,
coverage, the editing lock — fresh at read time. This was always true of the
payment vertical ("Paid" has never been a stored value); the bill vertical
used to be the exception, with a stored `bill.status` enum and a transition
table mirroring this document's old shape. It no longer is — see the bill
vertical section below for why, and what one narrow exception remains for
query performance.

## Payment vertical

### Stored fields

- `payment.canceledAt: timestamp | null` — set once, never cleared. Marks the
  payment as deliberately called off.
- `payment.confirmedPaidAt: timestamp | null` — set once, never cleared, by
  `confirmPaymentPaidDespiteCancellation`. Staff's explicit resolution of the
  canceled+claimed collision described in ["Derived
  status"](#derived-status) below: it acknowledges that a claim landed for a
  payment that also carries `canceledAt`, and flips the payment's *display*
  back to Paid. The action only ever sets it once both `canceledAt` and an
  active claim already exist (see ["Guard"](#guard)) — it is a resolution of
  an existing collision, not a way to mark an arbitrary payment paid without
  a claim behind it, and it never feeds into [Bill payment
  coverage](#bill-payment-coverage), which keeps reading claims only.
- `payment.excessAcknowledgedAt: timestamp | null` — set once, never
  cleared, by `acknowledgePaymentExcessSettlement`. Staff's explicit
  resolution of the duplicate-settlement collision described in ["Duplicate
  settlement"](#duplicate-settlement) below: it acknowledges that this
  payment has been claimed for more than its own `amount` (e.g. two offline
  devices each independently settling it through a different method) and
  silences the warning. Unlike `confirmedPaidAt`, it doesn't change what
  `derivePaymentStatus` returns — the payment is unambiguously Paid either
  way — it only silences a separate, additive warning about the *amount*.
- `payment.expiresAt: timestamp | null` — set at creation time from the
  payment method's own expiry (e.g. a Lightning invoice's `expirySeconds`,
  or the expiry of the invoice the merchant's Lightning address issued,
  `lightning-address/0004`; with both prepared at once, the earlier one).
  `null` means the payment never expires on its own (cash, card terminal
  — Switchio or Qerko —, a Qerko payment, IBAN transfer — there is no natural "too late" for those; staff waits as
  long as it takes, or explicitly cancels — see ["Editing
  lock"](#editing-lock)). It describes the payment as a whole, and payment
  methods are not mutually exclusive, so it is only non-`null` while *every*
  prepared method has an expiry window: preparing cash, a card terminal or
  IBAN alongside (or after) a Lightning invoice clears it, since the payment
  stays payable through that method no matter how long the invoice has been
  dead. `preparePaymentMethod` maintains this.

Beyond these, no other payment status field exists. "Paid" is still normally
read off the `reconciliationClaim` table (see below) rather than stored
directly on `payment`, because a claim is a first-class fact (which account
transaction paid it, when, automatically or manually) that a boolean could
not carry. `confirmedPaidAt` doesn't change that — it only overrides which
*display* status wins when `canceledAt` and a claim disagree.

### Derived status

A payment's display status is computed at read time, in this precedence
order (first match wins):

| Priority | Status | Condition |
|---|---|---|
| 1 | **Paid** | `confirmedPaidAt !== null` — staff's explicit resolution, see below |
| 2 | **Canceled** | `canceledAt !== null` |
| 3 | **Paid** | an active (non-deleted) `reconciliationClaim` exists for this payment |
| 4 | **Expired** | `expiresAt !== null` and `now > expiresAt` |
| 5 | **Pending** | none of the above |

Priorities 1 and 3 both display as **Paid** — there is only one `paid` value
in `PaymentStatus`. What differs is how the display got there: priority 3 is
the ordinary path (a claim exists, nothing else overrides it); priority 1 is
staff overriding a `Canceled` display that priority 2 would otherwise win.

**Canceled outranks Paid on purpose.** A payment can end up with both
`canceledAt` and an active claim in two ways. Money can arrive after the
cancellation: a bank transfer or a Lightning payment the customer sent anyway
is still matched to the canceled payment by the automatic reconciliation
(payment/0004), on a single device just as well as across several. And this is
a CRDT/local-first app: two devices can race — one cancels while another
records a claim for the same payment — and the merged result carries both.
Rather than trying to make that impossible (it isn't, without a central lock,
and refusing the money would leave it unmatched), the model accepts it and
resolves it deterministically: the explicit human decision to cancel is
treated as authoritative for how the payment itself is *displayed*, so it
still shows as **Canceled**. The money that arrived anyway is not lost or
hidden — it still counts toward the bill's coverage sum below, which is
exactly what surfaces this edge case to staff (as an `overpaid` bill) instead
of silently discarding it.

**`confirmedPaidAt` outranks Canceled — staff's explicit resolution.** The
precedence rule above is deliberately conservative by default (an explicit
cancellation wins), but it can leave a payment permanently mislabeled
Canceled even though real money is sitting in the bill's coverage sum.
`confirmPaymentPaidDespiteCancellation` is the staff-facing escape hatch for
that: once both `canceledAt` and an active claim exist, staff can
acknowledge the collision and flip the display back to Paid. This changes
nothing about `canceledAt` itself (still never cleared) or about coverage
(still computed from claims only, unaffected by this field) — it only
changes which status a human looking at this one payment sees.

**Paid outranks Expired.** A claim landing after the expiry window just means
the payment arrived late — the money is real regardless of the clock, so it
still counts as Paid.

**Pending** is the status that matters for locking a bill — see below.

**A Qerko attempt is not a status.** While the customer pays a Qerko payment
(the QR one) in the Qerko app, its `qerkoPaymentAttempt` is `started` or
`processing` (derived from its write-once columns, `qerko/0013`), and the
payment stays **Pending**: only Qerko's `PAID` records the money and its claim
(`qerko/0008`). A failed attempt leaves the payment Pending too, so the
customer can try again; another attempt is refused only while one is still in
progress.

### Guard

`cancelPayment` rejects a payment that already has an active
`reconciliationClaim` — a payment that has been paid cannot be canceled. This
guard only covers the order "paid, then canceled". It cannot stop money that
arrives after the cancellation, nor a concurrent multi-device merge — those
cases are handled by the precedence rule, not by trying to make the guard
airtight.

The manual confirmations `markPaymentPaidCash` and `markPaymentPaidIban`
reject a canceled payment with `PaymentCanceledError`: staff confirming money
by hand on a payment they called off is contradicting their own decision.
The automatic reconciliation and a card terminal's result do not — they
record money that really arrived. Among several payments matching one
incoming transaction, the reconciliation prefers a live one and takes a
canceled one only when nothing else matches (payment/0004).

`confirmPaymentPaidDespiteCancellation` is the mirror guard for that residual
case: it requires **both** `canceledAt !== null` and an active claim to
already exist before it will set `confirmedPaidAt`, rejecting with
`PaymentNotCanceledError` or `PaymentNotClaimedError` otherwise. It exists
specifically to resolve the collision `cancelPayment`'s guard cannot prevent
— it is not a general-purpose "mark any payment paid" action.

### Duplicate settlement

A payment can end up with more than one active `reconciliationClaim`,
pointing at *different* underlying `accountTransaction` rows — most
commonly a genuine CRDT merge race: two offline devices each independently
settle the same payment through a different method (e.g. one confirms it in
cash while another reconciles a matching incoming bank transfer), and since
each claim is real money, neither is discarded on merge. It can also arise
deliberately: `preparePaymentMethod` lets one payment be prepared with more
than one method at once (cash, Lightning, IBAN all offered for the same
amount, not mutually exclusive — see `payment.ts`'s satellite tables), and
`claimManualReconciliation` (unlike the automatic matchers) has no
already-claimed exclusion, so staff can manually attach more than one
transaction to a payment. The IBAN matcher drops that exclusion too, after
every unpaid payment: a customer who sends one payment's bank transfer
twice overpays it (payment/0007).

Either way, [Bill payment coverage](#bill-payment-coverage) sums the
*distinct claimed transactions*' real amounts (deduplicated by transaction
id, not payment id), so a payment claimed for more than its own `amount`
correctly shows up as extra money rather than being silently capped at the
nominal amount. `acknowledgePaymentExcessSettlement` is staff's explicit
resolution: it requires the payment to actually be claimed for more than its
`amount`, rejecting with `PaymentNotOverpaidError` otherwise, and sets
`excessAcknowledgedAt` once that's confirmed. This is a separate collision
from canceled+claimed above — a payment can be simultaneously
Canceled-despite-claimed *and* over-claimed, and resolving one never writes
to the other's field.

### Refunds

A `refund` row (the `refund` module) records money returned to a customer
for a payment that is Paid: an amount, how it went back (cash from the cash
register, back to the card through the Qerko terminal, or outside Payky such
as on another card terminal) and when. A refund
by items adds one `refundLine` per returned `paymentLine` of the payment's
frozen lines, with the quantity returned, and is offered only while no other
payment of its bill has a claim. A refund by amount or by items returns
goods only.
`refundPayment` refuses a payment that is not Paid and an amount of zero or
above what is left: the cash received for a cash payment with a received
amount, the payment's `amount` otherwise, plus what its claims brought
beyond `amount`, less the payment's tip and every earlier refund of goods.
In cash with a received amount, the tip is what the cash brought above the
goods rounded to whole crowns (see
[`payment/0003`](decisions/payment/0003-a-cash-tip-is-what-the-goods-leave.md)). When there is such an excess, the refund dialog prefills it, capped
at what is left. A refund of a CZK payment from the cash register is
prefilled in whole crowns, never above what is left. The refund keeps the
exact amount it returns, and a refund from the cash register records beside
it the cash it hands out (`refundCashRegister.handedAmount`): that amount
rounded to the whole crown, the goods and the tip of a whole refund rounded
once as one sum. The cash register's transaction and the EET storno carry
the cash handed out (see
[`refund/0012`](decisions/refund/0012-a-cash-refund-hands-out-whole-crowns.md)).

The tip is refunded on its own: `refundPaymentTip` returns the whole tip as
a refund with `isTip` set, once per payment (its id is
derived from the payment), in cash or outside Payky, whoever the tip belongs
to. A refund without `isTip` is a refund of goods, which covers every refund
recorded before the flag existed.

A refund back to the card through the Qerko terminal is not a `refund` row
until the terminal approved it: a `qerkoTerminalRefundAttempt` carries it
meanwhile, and the refund, its lines and the money leaving the Qerko account
are written together on approval ([`qerko/0004`](decisions/qerko/0004-a-card-refund-is-recorded-only-once-the-terminal-approved-it.md)).
It is offered only for a payment taken through Qerko, and `refundPayment`
does not accept that method.

A Qerko payment (the QR one) is refunded whole or not at all: Qerko cancels
it, which returns all of it, and the refund is recorded as its goods and its
tip once Qerko says `CANCELLED`
([`qerko/0010`](decisions/qerko/0010-a-qerko-payment-is-refunded-whole-once-qerko-cancelled-it.md)).
It is refused once part of the payment is refunded another way, and
`refundPayment` does not accept that method either.

A refund is not a state. It never touches `canceledAt`, `confirmedPaidAt` or
any claim, so the payment stays Paid, and coverage still sums the claimed
transactions, so its bill stays covered and closed. The payment detail, the
bill's payment rows and the payment history derive "partly refunded" or
"refunded" from the refunds of goods alone, so a tip refund never changes
that state and the refund list labels it as the tip. A cash refund writes a
negative `cashRegister` account transaction that no payment claims, which
keeps it out of every coverage sum.

## Bill vertical

### Stored fields

- `bill.canceledAt: timestamp | null` — set once, never cleared. An explicit
  human decision to discard the bill (the trash icon on the bill page, or
  `cancelBill`). Exactly the same shape and role as `payment.canceledAt`.
- `bill.confirmedClosedAt: timestamp | null` — set once, never cleared.
  Staff confirmed the bill closed, and its *derived* status is `closed`
  whatever else is true of it. Exactly the same shape and role as
  `payment.confirmedPaidAt`. It has two sources:
  - `confirmBillClosedDespiteCancellation`, staff's explicit resolution of
    the canceled+funded collision described in ["Reading the
    combination"](#reading-the-combination) below: it acknowledges that the
    bill's payments already cover its total despite the cancellation, and
    flips the bill's derived status from `canceled` to `closed`;
  - `closeZeroBill`, "Finish" on a bill whose goods come to exactly zero,
    which no payment can settle — see ["Finishing a bill that comes to
    zero"](#finishing-a-bill-that-comes-to-zero) below
    ([`payment/0013`](decisions/payment/0013-a-bill-that-comes-to-zero-is-finished-without-a-payment.md)).
- `bill.closedAt: timestamp | null` — **not** a source of truth for
  anything. A best-effort, self-healing *cache*: written (idempotently)
  whenever a claim brings the bill's coverage out of `underpaid`, regardless
  of `canceledAt`; by a cart write that brings a partly paid bill's total
  down to exactly what was paid (see ["Cart writes on a partly paid
  bill"](#cart-writes-on-a-partly-paid-bill) below); and by `closeZeroBill`
  together with `confirmedClosedAt` — see ["`closedAt` is a cache, not a
  status"](#closedat-is-a-cache-not-a-status) below for why it exists and
  what its one job is.

There is no `bill.status` column. `open`/`closed`/`canceled` is derived at
read time — see the next section — the same way a payment's display status
has always been derived rather than stored.

### Derived status

A bill's display status is computed at read time, in this precedence order
(first match wins), mirroring the payment vertical's shape:

| Priority | Status | Condition |
|---|---|---|
| 1 | **Closed** | `confirmedClosedAt !== null` — staff confirmed the closing, see below |
| 2 | **Canceled** | `canceledAt !== null` |
| 3 | **Closed** | at least one of the bill's payments has an active claim, **and** coverage (see below) is not `underpaid` |
| 4 | **Open** | none of the above |

**Canceled outranks Closed by coverage, for the same reason as the payment
vertical:** an explicit discard should not be silently undone just because a
stray/late claim happens to cover the total. `confirmBillClosedDespiteCancellation`
is the explicit staff override for that collision, and outranks `canceledAt`
the same way `payment.confirmedPaidAt` outranks `payment.canceledAt` — see
["Reading the combination"](#reading-the-combination).

**Priority 3 requires an active claim, not just "coverage isn't
underpaid".** `deriveBillCoverage` (see below) says a bill with `billTotal
== 0` is trivially `paid` even with zero claimed payments — which is exactly
true of a **brand-new, still-empty cart** the instant it's created (bill
created lazily, no line items yet, `billTotal === claimedSum === 0`), and of
a bill whose lines only add up to zero (free items) while staff are still
ringing it up. If "closed" only checked coverage, either would read as
closed/uneditable before staff were done with it. Requiring at least one
active claim is what keeps that from happening: closing always requires an
actual settling event — a real claim, or staff confirming the closing
(`confirmedClosedAt`, priority 1) — not merely the absence of anything owed.
A bill whose goods come to zero can never get a claim, since no payment can
be created for it
([`payment/0012`](decisions/payment/0012-a-payment-is-created-only-for-goods-worth-more-than-zero.md)),
so it is closed the second way, with "Finish" (see ["Finishing a bill that
comes to zero"](#finishing-a-bill-that-comes-to-zero)).

### Editing lock

Editing the bill's line items — the guard behind `addCatalogItemToBill`,
`addManualAmountToBill`, `addTipToBill`, `appendRemoveBillLine`,
`appendGuardedBillLines` (the cart's clear, undo and redo), `splitBill` and
`splitBillIntoNewBill` — requires more than a derived status of `open`. A
bill is also **locked** whenever it has a *live* payment attempt:

```
editable = deriveBillStatus(...) === "open"
           AND no payment on this bill has derivePaymentStatus === "pending"
```

This is a **derived** condition — nothing is written to lock a bill.
`isBillLocked` recomputes it from the bill's payment rows every time a
cart-editing action is attempted. The moment every live payment for a bill
resolves (paid, canceled, or expires), the bill becomes editable again
automatically: there is no separate "unlock" action, and no way for a lock
to get stuck from a write that never landed, because no write ever created
it in the first place.

**Creating a new payment deliberately does not check this lock.** Since a
bill can have more than one payment (split payments), starting a second
payment attempt while another is still pending and unresolved is allowed.
What it does check, besides the bill being `open`, is that there is
something to charge — see ["Creating a payment"](#creating-a-payment).
Like every guard in this document, this is best-effort for the common
single-device path, not a proof — see `requireBillAcceptingPayment` vs.
`requireEditableBill` in `bill-actions.ts`, and [Bill payment
coverage](#bill-payment-coverage) for what a multi-device race past it
produces and why it can't simply be prevented outright.

**The gap this closes.** A bill must stop accepting edits the moment a
payment attempt is genuinely in flight, not only once money has arrived —
otherwise nothing stops staff from changing the cart mid-payment while a
customer is looking at a QR code for a specific total, on a bill whose
derived status alone would still call `open`.

**The gap this leaves — and how it's closed.** The lock only clears itself
once the live payment resolves. Lightning has a natural resolution path via
`expiresAt`: an abandoned invoice expires on its own. Cash and IBAN have no
such expiry (`expiresAt` stays `null`) — so without an explicit cancellation,
a forgotten cash/IBAN attempt would lock its bill indefinitely. This is why
the payment-wait screen has a **"Cancel payment"** button, visible any time a
payment is not yet paid or canceled: it is the manual escape hatch that
makes the lock recoverable for every payment method, not only the ones with
an expiry.

### Cart writes on a partly paid bill

A bill can be `open` and editable with money already claimed against it: a
split payment covered part of it and nothing is pending. Every cart write
above then judges the total the bill would come to after it, against what
its payments have paid (`deriveCartWriteClosing` in `bill-utils.ts`,
`requireCartWriteNotBelowPaid` in `bill-guards.ts`,
[`payment/0014`](decisions/payment/0014-a-cart-write-that-pays-a-bill-off-closes-it.md)):

| After the write | Outcome |
|---|---|
| no active claim on the bill | written, the bill stays open — as before |
| total > what was paid | written, the bill stays open |
| total = what was paid | written, and `closedAt` with the lines in one batch: the bill is now `closed` by coverage |
| total < what was paid | refused with `BillTotalBelowPaid`, nothing written |

- The total after the write is the same projection coverage reads: the
  bill's line ledger with the new lines folded on after it, through
  `calculateBillLineSummaries`, tip lines included as `deriveBillCoverage`
  counts them.
- A split judges both bills, the source first. Its new bill has no payment
  and always stays open.
- The refusal exists because a bill closed below what was paid is
  `overpaid`: closing it would hand money back outside a refund. Staff
  return money through a refund on the payment instead, and the apps say so.
- Without the `close` row, taking an item off a partly paid bill — or, once
  a line can be worth less than nothing, adding a discount to it — made its
  derived status `closed` while `closedAt` stayed empty: the bill hung on
  the floor view and could be neither edited, paid nor canceled, every guard
  reading it closed. A bill left that way before this rule is not repaired
  automatically; `cli bills close` writes its `closedAt`.
- Like every guard here it is best-effort: two offline devices can each pass
  it and together take a bill below what was paid, or pay it off without
  either writing `closedAt`. `closedAt` stays a cache, and `closeBill`
  repairs it.

### Creating a payment

`createPayment` is the only place a payment row is written, and it creates
one only when the payment's **goods come to more than zero** and **at least
one payment method the payment will offer can collect more than zero of them
once it rounds them**
([`payment/0012`](decisions/payment/0012-a-payment-is-created-only-for-goods-worth-more-than-zero.md)):

1. A bill is accepted only through `requireBillAcceptingPayment`: the bill
   must be `open`, and then its goods must come to more than zero; otherwise
   it is refused with `BillTotalNotPositive`. The goods are the bill's lines
   without its tip lines (`deriveBillGoodsTotal`): a tip added to the cart
   cannot lift a bill whose goods come to nothing into one that can be
   charged. The check reads the bill, not the `amount` the caller chose for
   the payment.
2. Then, for a bill or a keypad payment alike, the methods the payment
   offers are judged against the payment's own goods — its amount without
   its tip, which is what settling it in cash judges — and, for a bill, also
   against the bill's goods as above, by `isPayableThroughAnyMethod` in
   `bill-utils.ts`, which asks `isBillPayable` of each method. Otherwise it
   is refused with `NoPayableMethod`
   ([`payment/0017`](decisions/payment/0017-a-payment-offers-only-what-its-screen-can-settle.md)).
   - The apps create a payment before a method is picked, offering every
     payment method turned on at once; such a payment offers the accounts
     turned on in its currency that the payment screen shows a tab for
     (`derivePaymentMethodsOffered`). One created with a method's details
     (the CLI's `--cashRegisterAccountId`) offers that one.
   - Only cash rounds. A CZK charge of 0.40 rounds to no crowns in cash
     ([`payment/0002`](decisions/payment/0002-czk-cash-rounds-to-whole-crowns.md)),
     while a card or a bank QR takes the 0.40 as it is. So goods above zero
     are refused only where cash is the one method on — a cash-only shop.
     With no method turned on nothing rounds, and the payment screen says
     what is missing.
   - The card terminal counts as offered only where the creating device
     can drive it (`cardTerminalLinked`, the native app), and Qerko payments
     only with the pairing's restaurant: the checks the payment screen shows
     their tabs by. Counting a method the screen leaves out created a
     payment nothing on screen could settle.
   - The cart keeps Charge disabled where the core would refuse
     (`deriveBillCheckout`, over the same accounts, the same device checks
     and the same function).

Cash then refuses to **settle** a payment cash cannot take:
`markPaymentPaidCash` refuses one whose goods — its amount without the tip —
round to nothing in cash (`isCashPayable` in `payment-cash-utils.ts`) with
`CashAmountRoundsToZero`. The payment screen offers no cash for it by the
same function; the refusal holds the rule for the CLI, an older app and the
test bridges. It judges the payment as created, not the bill as it stands
later.

- Both rules hold **when the payment is created** (and, for cash, when it is
  settled), and nothing judges the bill again: not a Qerko `paymentStart`, a
  terminal's result or a later claim. A bill whose total drops to zero after
  its payment was created ends up closed and overpaid once that payment is
  settled, like any bill whose lines were taken off after its payment was
  created (see ["Bill payment coverage"](#bill-payment-coverage)).
- `updatePayment` cannot move a payment onto a bill, so the check cannot be
  skipped by attaching a payment afterwards (the CLI's `payments update` has
  no `--billId`).

A bill whose goods come to exactly zero is finished instead.

### A bill below zero

A bill whose discounts outweigh its goods
([`payment/0015`](decisions/payment/0015-a-bill-below-zero-can-only-be-discarded.md))
can only be discarded: `BillTotalNotPositive` refuses it for every method, a tip
line included, `closeZeroBill` needs exactly zero, and both apps keep Charge
disabled with a hint. Its coverage reads `paid` while nothing is claimed
(above), and its status stays `open` until it is discarded. A split may not
leave any bill that still has lines with a total below zero
(`BillSplitTotalNegative`); a bill left at exactly zero is fine, being
finished instead. A partly paid bill never gets there: a cart write may not
take it below what was paid ([Cart writes on a partly paid
bill](#cart-writes-on-a-partly-paid-bill)).

### Finishing a bill that comes to zero

`closeZeroBill` ("Finish" in the apps, `apps/cli/src/cli-bills.ts
close-zero`) closes a bill whose goods come to exactly zero without any
payment
([`payment/0013`](decisions/payment/0013-a-bill-that-comes-to-zero-is-finished-without-a-payment.md)):

- the bill must be editable (`requireEditableBill`: `open`, no payment in
  flight), carry at least one line once adds and removes are netted — an
  empty cart is not a sale — and have no tip line; anything else is refused
  with `BillNotZero` (or the guard's own error);
- one write sets both `closedAt` (the floor view and the sales statistics
  filter on it) and `confirmedClosedAt`, so the bill's derived status is
  `closed` at priority 1 and the closing is final. The statistics count it
  as sold, its free items included. No payment, payment number, EET sale or
  refund comes of it.

The closing does not wait for every device to have seen it. A device that
has not can still add a line to the bill; once synced, the bill stays
`closed` with coverage `underpaid` (a positive total, nothing claimed). The
bill detail shows that as an underpayment, the bill history flags it the
same way, and staff ring the missing item up on a new bill — there is no
"reopen". Two devices finishing the same bill write the same fields; one
finishing it while another discards it ends `closed` without a reported
collision, which for a bill worth nothing loses nothing.

### `closedAt` is a cache, not a status

Nothing that decides money-correctness — the editing lock, `requireEditableBill`,
`requireBillAcceptingPayment`, `requireCancelableBill`, the bill detail
page's badge — reads `bill.closedAt`. They all go through
`loadBillStatusSnapshot`/`useBillStatus`, and so through `deriveBillStatus`,
which recomputes status live from `canceledAt`/`confirmedClosedAt` and a
fresh coverage calculation every time. `closedAt` exists for exactly one
consumer: `openBillsQuery`, the reactive list behind
the POS floor overview and the assign-table dialog.

That query needs to cheaply answer "which bills are still open" without
computing coverage (a bill-line-ledger sum vs. a claimed-payments sum) for
every bill the account has ever had — a scan that only grows over the
account's lifetime. `closedAt IS NULL AND canceledAt IS NULL` is a plain
indexed filter that answers the same question in the overwhelming majority
of cases, because `closedAt` is written the moment the bill stops being
`underpaid` with a claim behind it, the same trigger `deriveBillStatus`'s
priority 3 reacts to live. That happens in one of two writes: a claim that
pays the bill off (via `loadBillClosedAtIfCovered`, folded into the same
mutation batch as the confirming claim — see
`reconciliation-claim-actions.ts`), or a cart write that brings a partly
paid bill's total down to what was paid (via `requireCartWriteNotBelowPaid`,
folded into the same batch as its lines — see ["Cart writes on a partly paid
bill"](#cart-writes-on-a-partly-paid-bill)).

The two can disagree, briefly: under CRDT/multi-device concurrency, two
split payments on the same bill confirmed at nearly the same time can each
compute "still underpaid" from a pre-write snapshot that doesn't yet include
the other's claim, and neither writes `closedAt`. Once both facts have
synced, `deriveBillStatus` reflects the true, covered status on the very
next read anywhere it's consulted live — but `openBillsQuery`'s cache can
lag until something else writes to that bill again. The bill lingers in the
floor view's "open" list a little longer than it should; nothing incorrect
happens with money, editing, or guards. `closeBill` (see below) is the
manual repair tool for exactly this lag.

`closedAt`'s value, once set, is preserved across any later re-close instead
of being overwritten with a newer claim's time (`loadBillClosedAtIfCovered`'s
`billResult.value.closedAt ?? now()`) — it always reflects the first time
this bill was observed covered, i.e. roughly when the money arrived.

### `closeBill` and `confirmBillClosedDespiteCancellation`

Besides `closeZeroBill` above, two actions write the fields above outside
the automatic claim path, both in `bill-actions.ts`:

- **`closeBill`** (`apps/cli/src/cli-bills.ts close`) manually refreshes the
  `closedAt` cache — a repair tool for the lag described above, not a way to
  force a bill closed. It rejects a `canceled` bill (use
  `confirmBillClosedDespiteCancellation` for that collision) and one with no
  active claim yet or still `underpaid` (`BillUnderpaidError`) — a bill with
  nothing actually settling it can never read as closed, matching
  `deriveBillStatus`'s priority-3 requirement above.
- **`confirmBillClosedDespiteCancellation`** resolves the canceled+funded
  collision: requires an existing `canceledAt` **and** an already-covered
  bill (an active claim, coverage not `underpaid`), rejecting with
  `BillNotCanceledError`/`BillUnderpaidError` otherwise. See ["Reading the
  combination"](#reading-the-combination) for the collision itself.

## Bill payment coverage

Only a **bill** has under/overpaid coverage. `PaymentStatus` (see the payment
vertical above) has no such value — a single payment is always exactly
Paid, Canceled, Expired, or Pending; its own narrower money-mismatch is the
[Duplicate settlement](#duplicate-settlement) collision, not this one.

A bill's payments are compared against its line-item total to answer "has
this bill actually been paid for":

```
claimedSum = Σ over every payment with payment.billId = bill.id:
               max(0, Σ accountTransaction.amount − payment.tipAmount)
                 over every *distinct* accountTransaction actively claimed
                 against that payment
             — regardless of that payment's own canceled/expired display status

billTotal = sum of the bill's line-item summaries (bill-line ledger, "add" − "remove")
owed      = max(0, billTotal)
```

`billTotal` keeps the sign of its lines: a discount line is below zero
(catalog/0002), and a discount that outweighs the goods takes the total below
zero. Nothing is clamped in the projection. Coverage measures a negative
total as nothing owed, so a bill below zero with nothing claimed reads `paid`,
not `overpaid`, and one with money claimed is `overpaid` by all of it.

The inner sum is over *distinct claimed transactions*, deduplicated by
transaction id rather than payment id — see ["Duplicate
settlement"](#duplicate-settlement). Normally a payment has exactly one
claimed transaction whose amount equals `payment.amount`, so this reduces to
the single-transaction case; it only differs when a payment ends up claimed
for more (or, mid-split, less) than its own amount. `payment.tipAmount` is
subtracted once per payment (not per transaction) because it already
includes the tip on top of what was charged for the bill's items (see
`calculatePaymentAmounts`) — a tip is gratuity, not part of what the bill's
line items are worth, and must not skew the comparison.

| Coverage | Condition |
|---|---|
| **paid** | `claimedSum == owed` (a bill with `billTotal <= 0` and nothing claimed is trivially `paid` — but see the derived-status section above for why that alone doesn't make it `closed`) |
| **underpaid** | `claimedSum < owed` (includes the common case of no claimed payment at all, `claimedSum == 0`) |
| **overpaid** | `claimedSum > owed` |

This is computed purely from data, with no stored field. Without
`confirmedClosedAt`, a bill's derived status is `closed` precisely when this
stops being `underpaid` *and* at least one claim exists (see the bill
vertical's ["Derived status"](#derived-status-1) above) — so a bill its
payments closed is always `paid` or `overpaid`, never `underpaid`, by
construction. Only a bill staff finished at zero can read `underpaid`: one
that a device which had not yet seen the closing added a line to.

**Why coverage can diverge from `billTotal` at all.** A payment's `amount`
is fixed the moment it's created and never renegotiated — nothing keeps it
in sync with the bill's line-item total afterward. On a single device this
can't cause a mismatch: [the editing lock](#editing-lock) blocks line edits
from the moment a payment exists for the bill, so the total a payment was
created against can't change under it before that payment resolves. The
mismatch is only reachable across devices — one device edits the bill's
lines while, offline, another already created or claimed a payment against
the pre-edit total; once synced, the fixed payment amount and the
just-changed total simply don't line up. This is the same category of gap
as the two collisions above (a local-first guard is only ever best-effort
per device): coverage's job is to surface the resulting mismatch after the
fact, not to prevent it. See ["Reading the
combination"](#reading-the-combination) for the other, single-device path to
`overpaid` (a canceled bill whose pending payment is confirmed anyway).

**Showing *what* changed, not just that it did.** Knowing the two amounts
disagree doesn't tell staff *why* — for that, the payment detail page also
shows a diff of the bill's line items against what they were when the
payment was created. This can't be reconstructed after the fact from
`billLine.createdAt`: under CRDT/multi-device sync, a device can create a
payment *before* it has synced an earlier (by timestamp) edit from another
device, so filtering the ledger by "created before this payment" would
include changes this device never actually saw when it computed the
payment's amount. What a device locally believed the bill looked like at
write time is a fact that only exists in that moment — if it isn't captured
then, it's gone.

So it's captured explicitly instead: `createPayment` freezes the bill's
current line-item summaries as `paymentLine` rows tied to the new payment
(see `snapshotBillLinesForPayment` in `payment-line-actions.ts`), in the
same mutation batch as the payment itself — one row per net line, the same
shape `calculateBillLineSummaries` produces, immutable from then on. A
payment created before this existed simply has no snapshot rows; the diff
is skipped for it rather than shown as "everything was added" (see
`paymentLinesByPaymentIdQuery`'s doc comment).

A bill's discount is frozen with it (catalog/0003): each goods line carries
its `discountShare`, its part of the discount lines that `allocateDiscount`
spread over the goods, and the discount line is kept as it stands, below
zero. The payment's VAT recap, its Qerko receipt and a refund of a line read
the net amount (`deriveLineNetAmount`) from these rows, so they stay what
the payment was made with. A row frozen before the column existed has no
share and nets to its own amount.

`deriveBillLineSummaryDiff` (`bill-line-utils.ts`) compares that frozen
snapshot against the bill's live summaries. It matches lines primarily by
`itemId` — content-addressed, so an exact match with an unchanged
quantity/amount is not reported at all, and one whose amount differs is
`changed`. A line present on only one side is then correlated by
`catalogItemId` (the menu item's identity, independent of its price)
against a line present on only the other side, so "removed: old-price
Coffee, added: new-price Coffee" is reported as a single `changed` entry
instead of two unrelated-looking lines. Only what's left after that is a
genuine `added`/`removed`.

## Reading the combination

| Derived `bill` status | coverage | editable? | Meaning |
|---|---|---|---|
| `open` | underpaid (0) | yes | ordinary cart, nothing charged yet |
| `open` | underpaid | **no** (locked) | checkout in progress — a live payment is pending |
| `open` | underpaid (>0) | yes | a split/partial payment was confirmed but didn't cover the total, and nothing is currently pending — bill stays open for the rest |
| `closed` | paid | — (final) | fully settled — the expected happy path |
| `closed` | overpaid | — (final) | more money confirmed than the bill is currently worth — see [why coverage can diverge](#bill-payment-coverage); needs a human to look at it |
| `closed` | paid (0) | — (final) | finished at zero without a payment (`closeZeroBill`) |
| `closed` | underpaid | — (final) | finished at zero, then given a line by a device that had not seen the closing — flagged as an underpayment, and the item goes on a new bill |
| `canceled` | underpaid (0) | — (final) | ordinary discarded cart, no payment was ever involved |
| `canceled` | paid or overpaid | — (final, until resolved) | a bill was discarded while a payment was still pending, and that payment was confirmed anyway — see below |

There is no bill-level stored state for "awaiting payment" — it is exactly
the `open` + locked row above, read from the two verticals together.
`closed` + `underpaid` never occurs for a bill its payments closed, by
construction of `deriveBillStatus`; it occurs only for a bill finished at
zero, as above.

**`canceled` + `paid`/`overpaid` is reachable through ordinary, single-device
use, not only a multi-device race.** `cancelBill` only checks the bill's
derived status (via `requireCancelableBill`) — unlike `createPayment`, it
does **not** consult the editing lock. So `open` with a pending payment →
`canceled` is an allowed transition: staff can discard a cart while a
payment is still in flight (the bill page's own UI makes this hard to
trigger by hiding the cart behind the "locked" message once a payment is
pending, but the domain guard doesn't forbid it). If that payment is
confirmed afterward, the claim still counts toward coverage (and still
refreshes the `closedAt` cache — see above), but the *derived* status stays
`canceled` until staff explicitly resolves it — see "the editing lock
rejects..." and "canceling a bill with a pending payment..." in
`payment-actions.test.ts`.

**This is the same shape as the payment vertical's canceled+claimed
collision, one level up.** A canceled bill whose payments already cover its
total is flagged to staff the same way a canceled+claimed payment is (see
the payment vertical), and `confirmBillClosedDespiteCancellation` is its
resolution action — staff acknowledges the collision, and the bill's
*derived* status flips fully from `canceled` to `closed`, without
`canceledAt` itself ever being touched. The two collisions are independent,
though related: a payment can display Canceled-despite-claimed regardless of
what its bill's derived status is doing, and resolving one never writes to
the other's fields.

## Non-goals / explicitly out of scope

- No automatic reopening of a `closed` or `canceled` bill back to `open`,
  ever, under any combination of payment outcomes.
- No automatic refund or reconciliation action when a bill is found
  `overpaid` — it is surfaced to staff visually; resolving it is a manual,
  out-of-band process. This includes the "Refund" action surfaced next to a
  canceled+claimed payment's, canceled+funded bill's, and duplicate-settlement
  payment's collisions in the UI — it is the same placeholder in all three
  places, not the [refund](#refunds) of a Paid payment, which returns at
  most what the payment itself took.
- No automatic resolution of any of the three collisions (payment
  canceled+claimed, bill canceled+funded, payment duplicate-settlement) —
  `confirmPaymentPaidDespiteCancellation`, `confirmBillClosedDespiteCancellation`,
  and `acknowledgePaymentExcessSettlement` are all manual, explicit staff
  actions, not something the app resolves on its own when a sync merge
  produces the collision.
- No enforcement that stops a bill from accumulating more than one
  concurrent payment attempt — multiple payments per bill (split payments)
  are an intended capability, not a bug to guard against, and creating a new
  payment deliberately does not check the editing lock.
- No live, wall-clock-driven re-render of the editing lock in the UI purely
  from time passing (e.g. a Lightning invoice crossing `expiresAt` with no
  other data change). The lock is recomputed reactively whenever the
  underlying payment/claim rows change, and freshly on every guarded write —
  it is not guaranteed to visually flip the instant a timer elapses with
  nothing else happening on screen.
- No SQL-level correctness guarantee for `openBillsQuery`'s "still open"
  filter — see ["`closedAt` is a cache, not a
  status"](#closedat-is-a-cache-not-a-status). It is a performance
  optimization allowed to be briefly stale, not a second source of truth.
