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
- `payment.excessAcknowledgedAt: timestamp | null` — written only by app
  versions before the overpayment card, which let staff silence a payment
  claimed for more than its own `amount` without saying where the money
  went. Nothing writes it now. An acknowledgement counts as a kept amount of
  that payment's extra money from the claims recorded before the first write
  of the column, at most the bill's overpayment then — see
  ["Overpayment"](#overpayment) below. It never changes what
  `derivePaymentStatus` returns.
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
nominal amount. That money is part of its bill's overpayment, and a payment
without a bill counts as its own bill, so staff answers it on the
overpayment card like any other — see ["Overpayment"](#overpayment). A
payment can be Canceled-despite-claimed *and* over-claimed at once; the card
then asks staff to confirm the canceled payment paid before it offers to
resolve its money.

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
[`payment/0003`](decisions/payment/0003-a-cash-tip-is-what-the-goods-leave.md)).
While the payment can return some of its bill's overpayment (the bill has
an unresolved overpayment, or is underpaid and the payment's claims brought
more than its `amount`), the refund screen offers the overpayment first and
starts on it, prefilled with what the payment can return of it, capped at
what is left; a part of the goods is prefilled with what is left. The refund
records at write time the part of it that returns the overpayment
(`overpaymentAmount`) and the transactions its device knew
(`knownTransactionIdsJson`) — see
[`refund/0014`](decisions/refund/0014-a-refund-records-what-it-returns-of-the-overpayment.md).
A refund of a CZK payment from the cash register is prefilled in whole
crowns, never above what is left. The refund keeps the exact amount it
returns, and a refund from the cash register records beside it the cash it
hands out (`refundCashRegister.handedAmount`): that amount rounded to the
whole crown, the goods and the tip of a whole refund rounded once as one
sum. The cash register's transaction and the EET storno carry the cash
handed out (see
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
transactions, so its bill stays covered and closed. What a refund returns
of the overpayment answers it — see ["Overpayment"](#overpayment). The
part of a refund that EET never received is written as a second row without
a device (`mainRefundId`), shown and counted with its main row as one refund
(see [`docs/eet.md`](eet.md)). The payment detail, the
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
- `bill.confirmedClosedAt: timestamp | null` — set once, never cleared, by
  `confirmBillClosedDespiteCancellation`. Staff's explicit resolution of the
  canceled+funded collision described in ["Reading the
  combination"](#reading-the-combination) below: it acknowledges that the
  bill's payments already cover its total despite the cancellation, and
  flips the bill's *derived* status from `canceled` to `closed`. Exactly the
  same shape and role as `payment.confirmedPaidAt`.
- `bill.closedAt: timestamp | null` — **not** a source of truth for
  anything. A best-effort, self-healing *cache*: written (idempotently)
  whenever a claim, or a line edit on a bill that already has one, brings
  the bill's coverage out of `underpaid`, regardless of `canceledAt`, and
  kept equal to the derived status by the bill closing job — see
  ["`closedAt` is a cache, not a status"](#closedat-is-a-cache-not-a-status)
  below for why it exists and what its one job is.

There is no `bill.status` column. `open`/`closed`/`canceled` is derived at
read time — see the next section — the same way a payment's display status
has always been derived rather than stored.

### Derived status

A bill's display status is computed at read time, in this precedence order
(first match wins), mirroring the payment vertical's shape:

| Priority | Status | Condition |
|---|---|---|
| 1 | **Closed** | `confirmedClosedAt !== null` — staff's explicit resolution, see below |
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
created lazily, no line items yet, `billTotal === claimedSum === 0`). If
"closed" only checked coverage, a fresh empty bill would read as
closed/uneditable before staff could add a single item. Requiring at least
one active claim is what keeps that from happening: closing always requires
an actual settling event (a real claim, even a $0 one for a fully-discounted
bill — see [Bill payment coverage](#bill-payment-coverage)'s "paid" row), not
merely the absence of anything owed.

### Editing lock

Editing the bill's line items — the guard behind `addCatalogItemToBill`,
`addManualAmountToBill`, `addTipToBill`, `appendRemoveBillLine`, and
`splitBill` — requires more than a derived status of `open`. A bill is also
**locked** whenever it has a *live* payment attempt:

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

### `closedAt` is a cache, not a status

Nothing that decides money-correctness — the editing lock, `requireEditableBill`,
`requireBillAcceptingPayment`, `requireCancelableBill`, the bill detail
page's badge — reads `bill.closedAt`. They all go through
`loadBillStatusSnapshot`/`useBillStatus`, and so through `deriveBillStatus`,
which recomputes status live from `canceledAt`/`confirmedClosedAt` and a
fresh coverage calculation every time. `closedAt` exists mainly for
`openBillsQuery`, the reactive list behind the POS floor overview and the
assign-table dialog. Table self-pay reads it too: it offers a bill in its
table's view while it is open, and credits money naming it up to 7 days
after it closed.

`openBillsQuery` needs to cheaply answer "which bills are still open" without
computing coverage (a bill-line-ledger sum vs. a claimed-payments sum) for
every bill the account has ever had — a scan that only grows over the
account's lifetime. `closedAt IS NULL AND canceledAt IS NULL` is a plain
indexed filter that answers the same question in the overwhelming majority
of cases, because `closedAt` is written (via `loadBillClosedAtIfCovered`,
folded into the same mutation batch as the confirming claim — see
`reconciliation-claim-actions.ts`) the moment a claim brings the bill out of
`underpaid`, the same trigger `deriveBillStatus`'s priority 3 reacts to live.
Lines leaving the bill are the other way out of `underpaid`: once a guest
has paid a share, staff can remove, undo or split off what is left. Each of
those writes `closedAt` in the same batch as the lines when the claimed money
covers what remains, so the bill leaves the floor view, its table's self-pay
view and the open-bill lists the moment its detail reads `closed`.

The two can disagree, briefly: under CRDT/multi-device concurrency, two
split payments on the same bill confirmed at nearly the same time can each
compute "still underpaid" from a pre-write snapshot that doesn't yet include
the other's claim, and neither writes `closedAt`. Once both facts have
synced, `deriveBillStatus` reflects the true, covered status on the very
next read anywhere it's consulted live — but `openBillsQuery`'s cache lags
until a device that runs background jobs has synced both. The bill closing
job (`bill-closing-job.ts`) starts after the app owner's first sync and
reads `evolu_history` from a rowid cursor it keeps in the local
`_billClosingCursor` table, as `cashu-booking.ts` does. Every bill whose
lines, payments, claims, claimed transactions or `closedAt` changed since
its last run is a candidate. On its first run, so is every bill with no
`closedAt` and no `canceledAt`, and every closed bill with a deleted claim
or claimed transaction. For each candidate without `canceledAt`, it writes
`closedAt` when the bill derives closed and its `closedAt` is missing or
more than a minute off the moment coverage last left `underpaid`, replaying
the bill's lines and claims in sync-clock order, and clears it when the bill
derives open again. It writes only what the derived status says, so a write
by another device cannot make it loop. Until it runs, the bill lingers in
the floor view's "open" list a little longer than it should; nothing
incorrect happens with editing or guards. With self-pay on, the bill also
stays in its table's view until then, so guests can still pay it and their
codes decode against the bill as it stands. `closeBill` (see below) remains
a manual repair tool.

A claim or an edit keeps an existing `closedAt`
(`billResult.value.closedAt ?? now()` in `loadBillClosedAtIfCovered`), and
the job corrects it when it is more than a minute off, so it reflects when
the money covered the bill, which self-pay's 7 days count from.

### `closeBill` and `confirmBillClosedDespiteCancellation`

Two actions write the fields above outside the automatic claim path, both in
`bill-actions.ts`:

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
```

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
| **paid** | `claimedSum == billTotal` (a bill with `billTotal == 0`, e.g. fully discounted, is trivially `paid` — but see the derived-status section above for why that alone doesn't make it `closed`) |
| **underpaid** | `claimedSum < billTotal` (includes the common case of no claimed payment at all, `claimedSum == 0`) |
| **overpaid** | `claimedSum > billTotal` |

This is computed purely from data, with no stored field. A bill's derived
status is `closed` precisely when this stops being `underpaid` *and* at
least one claim exists (see the bill vertical's ["Derived
status"](#derived-status-1) above) — so a `closed` bill is always `paid` or
`overpaid`, never `underpaid`, by construction.

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

### Self-pay payments

A guest paying at the table creates nothing until the money arrives. The
sync job that records the money writes the self-pay `payment` together with
its claim, so it is never pending, never locks the bill for editing, and
nothing a guest does without paying reserves a line or an amount. Two
guests paying the same remainder both land, and the bill reads `overpaid`.
Money naming a closed or canceled bill's reference still credits that bill,
never the next one at the table, when it arrives at most 7 days after the
bill ended. Later money stays unmatched.
"Pay" on the POS bill offers the total minus the bill's `claimedSum`, the
claimed money less each payment's tip, never below zero, so staff never
charge guests' money twice (`table-self-pay/0002`).

`selfPayAllocation` rows record which lines a self-pay payment paid for.
They only mark lines paid for guests, on the bill detail and on the POS
bill (`table-self-pay/0001`). Coverage and status never read them, so an
allocation that arrives after the bill closed changes nothing staff has to
resolve.

## Overpayment

A bill's overpayment is the money its claimed transactions brought above
the goods it keeps (`deriveBillOverpayment`, `bill-utils.ts`), and a payment
without a bill counts as its own bill, priced at its `amount` less its tip.
Staff answers it on the overpayment card in the bill detail, or in the
detail of a payment without a bill: a return through the refund dialog (see
[Refunds](#refunds)), a tip the guest confirmed leaving, or an amount kept
for the business. Tips and kept amounts are `overpaymentResolution` rows.
Neither is ever edited; a mistaken one is withdrawn by a further row naming
it, and a withdrawal is final. All of them need the refund permission.

The money above the total is attributed to the claimed transactions, and
each answer draws only from transactions its device knew that are still
there, its own payment's first, then the newest. Returns draw first, then
tips, kept amounts and acknowledgements in recording order, each capped by
what its payment holds less the earlier ones on it, and all of them together
by the money the bill still holds above the goods. Records are ordered by
the sync clock of their first write in `evolu_history`, because an upsert
rewrites `createdAt`. What no answer covers is the **unresolved
overpayment**. The card, the bill and payment histories and the payment
detail flag a bill overpaid only while it is above zero; once it is zero the
card lists how it was resolved, with the part of an answer beyond what the
money allows shown as not counted. A canceled bill has none. Tips from an
overpayment count in the sales statistics on the day they were recorded.
See [`payment/0013`](decisions/payment/0013-an-overpayment-is-returned-tipped-or-kept.md).

Before an edit, undo, redo or split that would leave an open bill covered,
the cart says whether the bill would be paid and closed or by how much it
would be overpaid (`loadBillEditOutcome`), and canceling leaves the bill as
it was. After an edit that overpays it, the bill detail offers the three
answers or deciding later. A split that would leave its source overpaid is
refused (`requireSplitLeavingNoOverpayment`), since nothing moves money
between bills. Two devices out of sync can still overpay a bill; the
derivation then shows it.

## Reading the combination

| Derived `bill` status | coverage | editable? | Meaning |
|---|---|---|---|
| `open` | underpaid (0) | yes | ordinary cart, nothing charged yet |
| `open` | underpaid | **no** (locked) | checkout in progress — a live payment is pending |
| `open` | underpaid (>0) | yes | a split/partial payment was confirmed but didn't cover the total, and nothing is currently pending — bill stays open for the rest |
| `closed` | paid | — (final) | fully settled — the expected happy path |
| `closed` | overpaid | — (final) | more money confirmed than the bill is currently worth — see [why coverage can diverge](#bill-payment-coverage); staff answers it on the overpayment card until its unresolved overpayment is zero — see [Overpayment](#overpayment) |
| `canceled` | underpaid (0) | — (final) | ordinary discarded cart, no payment was ever involved |
| `canceled` | paid or overpaid | — (final, until resolved) | a bill was discarded while a payment was still pending, and that payment was confirmed anyway — see below |

There is no bill-level stored state for "awaiting payment" — it is exactly
the `open` + locked row above, read from the two verticals together.
`closed` + `underpaid` never occurs, by construction of `deriveBillStatus`.

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

- No reopening of a `canceled` bill, and no payment outcome reopens a
  `closed` one. A closed bill derives `open` again only when the money under
  its claims is deleted or another device changed its lines after it closed,
  and the bill closing job then clears its `closedAt`.
- No automatic refund or reconciliation action when a bill is found
  `overpaid` — staff answers it on the overpayment card (see
  [Overpayment](#overpayment)). The "Refund" action surfaced next to a
  canceled+claimed payment's and canceled+funded bill's collisions in the UI
  is the same placeholder in both places, not the [refund](#refunds) of a
  Paid payment, which returns at most what the payment itself took.
- No automatic resolution of either collision (payment canceled+claimed,
  bill canceled+funded) or of an overpayment —
  `confirmPaymentPaidDespiteCancellation`, `confirmBillClosedDespiteCancellation`
  and the overpayment card's answers are all manual, explicit staff actions,
  not something the app resolves on its own when a sync merge produces them.
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
