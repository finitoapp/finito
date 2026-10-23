# EET reporting

How a received payment becomes an EET 2.0 sale (`tržba`), gets delivered,
how a refund reverses it, and what each state and edge case means. Read it before changing
`packages/core/src/modules/eet/*`, `eet-reporting-job.ts`, or
`packages/core/src/integrations/eet/*`. The decisions behind it, with the tests that
hold them, are recorded in [`decisions/eet/`](decisions/eet/), with the cash
and refund ones in [`decisions/payment/`](decisions/payment/) and
[`decisions/refund/`](decisions/refund/).

## Moving parts

| Piece | File | Role |
|---|---|---|
| `eetSettings` (one row, fixed id) | `modules/eet/eet.ts` | `enabledAt`, `environment`, `establishmentId`, `certificateId`, `tipOwner` |
| `eetCertificate` | same | EIC, validity, DER cert + **PKCS#8 private key** (base64), `isTestCertificate` |
| `eetSale` (id = `eetSale:<paymentId>:<accountTransactionId>`, `eetSale:<paymentId>` on a sale created before sales recorded their settlement, or `eetSale:<paymentId>:extra:<extraFrom>` for extra money) | same | Frozen snapshot of what is reported + last attempt bookkeeping. `extraFrom` is `null` on a payment's sale |
| `eetSaleConfirmation` (same id as sale) | same | FIK/`pok`, `receivedAt`, `isTest`, warnings. Its existence = confirmed |
| `eetReversal` (id = `eetReversal:<refundId>`) | same | Frozen snapshot of the negative sale one refund reports + last attempt bookkeeping |
| `eetReversalConfirmation` (same id as reversal) | same | Same as `eetSaleConfirmation`, for a reversal |
| Reporting job | `background-jobs/jobs/eet-reporting-job.ts` | Creates sales, delivers them, backs off |
| Client | `integrations/eet/eet-client.ts` | Signs + submits via `@finitoapp/eet-client`, maps errors to `retry`/`rejected` |
| Response verifier | `integrations/eet/eet-response-verifier.ts` | Checks the response signature |
| Playground certs proxy | `apps/web-app/api/eet/playground-certificates.ts` | Downloads the official test-cert ZIP from eet.gov.cz, returns `.p12` + password |

All tables live in the **app** Evolu database, so settings, the certificate
with its private key, and every sale sync to all devices of the account
(end-to-end encrypted by Evolu).

## Setup

1. **Certificate.** Either upload a `.p12` + password (`isTestCertificate: false`)
   or pick one of the official playground certificates (`isTestCertificate: true`).
   The file is rejected if the password is wrong, it has no private key, the
   CN is not an EIC (`CZ` + 8–10 digits), or it is expired / not yet valid.
   Storing a new certificate soft-deletes the previous one.
2. **Establishment id** (`id_jednotky`, 1–9 digits, no leading zero).
3. **Environment** — resolved by `resolveEetEnvironment`:

   | Build has `VITE_PAYKY_EET_PRODUCTION_URL` | Test certificate | Result |
   |---|---|---|
   | no | any | `playground` |
   | yes | yes | `playground` |
   | yes | no | stored `environment`, default `production` |

   `selectEetEnvironment("production")` refuses without a production URL or
   with a test certificate.
4. **Enable.** `enableEet` requires a non-expired certificate and an
   establishment id, then sets `enabledAt = now`. Disabling sets it to `null`.
   While enabled in `playground`, the terminal shows the sandbox banner and
   the payment-wait screen says so.
5. **Tip owner** — `business` (default): tip is part of the reported sale;
   `employees`: tip is subtracted (`calculatePaymentBaseAmount`). In cash
   with a tip, the tip is what the cash received brought above the goods
   rounded to whole crowns (`deriveReceivedTipAmount`).

The settings page also has a test card: a verification message (`overovaci`
mode, anywhere) or a real 1.00 CZK test sale (playground only). Neither writes
an `eetSale`.

## Which payments get reported

`eetPaymentsToReportQuery` selects a payment of any device when **all** hold:

- EET is enabled (`enabledAt !== null`),
- it has an active reconciliation claim, and the **first** claim's
  `claimedAt >= enabledAt`,
- no `eetSale` exists for it yet.

Payment status is ignored: a canceled payment that still got a claim is
reported (money arrived). The payment method does not matter either — cash,
card, Lightning and IBAN are all reported; the method of the first claim is
stored in `eetSale.method` but not sent.

## Recording device and takeover

Every sale and reversal has a **recording device**, stored as its `deviceId`:

| Record | Recording device |
|---|---|
| Sale | the first claim's `deviceId`: the device where staff confirmed cash or matched a transfer by hand, or whose card terminal approved the card |
| Sale whose claim names no device (FIO, Spark matched it) | `payment.deviceId`, the device that showed the QR code or invoice, or for a self-pay payment the device that opened its bill |
| Extra money sale | the same rule, applied to the payment's latest claim |
| Reversal | `refund.deviceId` |

A payment or refund without any device is never reported. The record's
**start time** is its `saleAt`, and for a reversal the later of the refund
and the latest confirmation of the payment's supported sales
(`getEetReversalStartsAt`), since a reversal cannot be sent earlier.

For the first 10 minutes after the start time (`EET_PRIORITY_PERIOD_MS`),
only the recording device's job creates and delivers the record. After that, the
job on **every** device of the account creates it if it is missing and
delivers it until confirmed. Whoever creates or sends it, the body stays the
recording device's: `id_pokl` is its cash-register id, so EET sees a
takeover as a resend of the same sale. The job sets one timer for the
earliest takeover still ahead, because no data change marks that moment.

`prvni_zaslani` (`firstSubmission`) is `true` only when all hold
(`isEetFirstSending`):

- the record has no attempt yet (`attemptStartedAt` and `lastAttemptAt` are
  both `null`),
- the sender is the recording device,
- the attempt starts within 5 minutes of the start time.

Everything else is sent as a repeat. The gap between the last possible first
sending (5 min) and the earliest takeover (10 min) absorbs device clocks
that disagree and a request still in flight. The mark therefore errs only
toward "repeated": a first attempt made late (the app was off), or a takeover
of a record the recording device never sent. It is wrong toward "first" only
when a device clock is more than 5 minutes ahead of the recording device's.

## Sale creation — what gets frozen

`createEetSale` writes the row once and never rewrites the reported data:

| Field | Value |
|---|---|
| `amount` | what the first claim brought, capped at `payment.amount` (`calculateEetSettlementValue`), or the cash received when the first claim is the cash register, minus the tip when `tipOwner = employees`. In cash with a tip, the tip is what the cash received brought above the goods rounded to whole crowns |
| `saleAt` (`dat_trzby`) | first claim's `claimedAt` |
| `accountTransactionId` | the first claim's transaction, the settlement the sale reports. `null` on an extra money sale and on a sale created before it existed |
| `sequenceNumber` (`porad_cis`) | the payment id |
| `cashRegisterId` (`id_pokl`) | first 20 chars of the recording device's id, so one register per device |
| `eic`, `establishmentId`, `environment` | current settings at creation time |
| `unsupportedReason` | `currency` if not CZK, `amount` if > 99 999 999.99 |
| `reportedTipAmount` | the tip the sale reports: the tip (in cash, the tip received) while tips belong to the business, `0` while they belong to employees and on every extra money sale. `null` on a sale created before it existed, read as `0` |

Later changes to settings (tip owner, environment, establishment) affect only
sales created afterwards — with one exception in "Manual retry" below.

## Delivery

The job subscribes to three queries for sales and two for reversals (see
"Extra money" and "Refunds and storno") and runs through a keyed queue: one
pass at a time, with at most one pending `create` and one pending `deliver`
pass:

- `eetSalesToDeliverQuery`: every device's sales that are supported,
  unconfirmed and whose `lastAttemptResult` is `null` or `retry`; the job
  sends its own at once and the others after their 10 minutes.
- Each delivery takes a Web Lock `eet-sale-<id>` (`ifAvailable`); if held,
  it is skipped as `EetSaleBusyError`.
- Signing always uses the **current** certificate, not the one active when the
  sale was created.
- Before the message leaves, the attempt is written as `attemptStartedAt` in
  its own batch. The outcome later sets `lastAttemptAt` to the same instant.
  An attempt that finds an `attemptStartedAt` with no `lastAttemptAt`, or a
  later one, inherits an attempt whose answer never arrived (the app closed
  mid-request) and sets `hadUnansweredAttempt`.
- `prvni_zaslani` follows "Recording device and takeover" above.

Outcome mapping (`eet-client.ts`):

| Situation | Outcome | `unanswered` |
|---|---|---|
| Accepted with FIK | `accepted` → writes `eetSaleConfirmation` | — |
| Network, timeout, HTTP, SOAP fault, bad XML, bad response schema | `retry` | yes |
| EET error code `-1` or `8` | `retry` | no |
| Build lacks production URL for a `production` sale | `retry` | no |
| Response signature invalid | `rejected` | **yes** |
| Any other EET error code, validation, too large, signer error, bad local data | `rejected` | no |

`unanswered: true` sets `hadUnansweredAttempt` (sticky, never cleared): EET
may have recorded the sale even though we got no usable answer.

Backoff for `retry`: 30 s · 2^(n−1), capped at 15 min, **no attempt limit**.
The backoff lives in memory: an app restart or an `online` event retries
immediately, also when the event arrives while an attempt is in flight. `rejected` sales are never retried automatically.

## Sale status

`deriveEetSaleStatus`, first match wins:

| Status | Condition |
|---|---|
| `testConfirmed` | confirmation exists and (`isTest` or sale env is `playground`) |
| `confirmed` | confirmation exists |
| `unsupported` | `unsupportedReason !== null` — never sent |
| `rejected` | `lastAttemptResult = rejected` |
| `pending` | everything else (not tried yet, or waiting for retry) |

**Overdue**: `pending` or `rejected` more than 48 h after `saleAt`. Shown as
a badge suffix and a warning on the payment detail.

Status is shown on the payment detail (with the amount sent, FIK, warnings,
last error, technical ids), per payment on the bill detail, and all
unconfirmed sales of the account are listed in Settings → EET.

## Manual retry

Payment detail offers **Retry** for `pending` and `rejected`. `retryEetSale`:

- If the last attempt was rejected, none went unanswered or was cut off,
  there is no FIK, and the current settings have a different EIC or
  establishment id, it first
  rewrites those two fields on the sale — EET never saw the sale, so fixing
  a typo is safe. Otherwise the frozen data stays.
- Then delivers exactly as the job does (same lock, same outcome recording).

Retry works from the recording device at any time, and from any other
device once the record has an attempt or its 10 minutes are over. Until then
the other device shows until when it waits for the recording device. An
attempt already made means the recording device's next message is a repeat
anyway, so a retry from elsewhere cannot make a first-sending mark wrong.

## Extra money

A payment's sale reports what its first claim brought, as the device
creating the sale sees the claims. Its **extra money** is everything its
claims bring beyond what its sales report: the rest of a payment the first
claim paid only in part, and any money above `payment.amount`. It is the
distinct claimed transactions in the payment's currency (the valuation bill
coverage uses) less the value, each capped at `payment.amount`, of the
settlements the payment's sales report. A sale reports the transaction its
`accountTransactionId` names. Each sale that names none, or names one no
active claim has, stands for the earliest settlement no sale names, and
before the payment has a sale its first claim counts. While tips belong to
employees and those settlements bring less than `payment.tipAmount`, the
extra money starts above the tip instead. A split between cash and a
transfer, a transfer larger than the payment, or a second transfer attached
by hand all bring some. Two devices that settle one payment while cut off
from sync each create a sale for their own settlement, so neither
settlement is extra money.

Money kept is a sale at the moment it arrives, and money returned is
reversed, so extra money is reported when it arrives rather than held back
until staff decides. `eetExtraClaimsQuery` lists the claims of payments that
may have extra money, and `deriveDueEetExtraSale` turns them into the next
**extra money sale**:

| Field | Value |
|---|---|
| `extraFrom` | the extra money already reported: the sum of the payment's extra money sales, or the extra money brought before `enabledAt` when that is larger |
| `amount` | the current extra money minus `extraFrom` |
| `method`, `saleAt` | the latest claim's, ordered by `claimedAt`, then claim id |
| `sequenceNumber` | the extra money sale's own id |

Each later increase becomes one more extra money sale at the next
`extraFrom`. Keying by the level lets a device that missed a claim report
the rest once the claim syncs. Extra money that shrinks because a claim was
removed keeps its sale. Everything else follows the sale's rules. The code
keeps "excess" for money above `payment.amount` only
(`calculatePaymentExcess`), which the refund limit uses.

## Refunds and storno

A refund (`refundPayment` in `modules/refund`) returns goods for a paid
payment, as an amount or as items, and never its tip. The tip has its own
refund (`refundPaymentTip`), marked by `refund.isTip`. The payment stays paid
and its bill stays closed (see `bill-payment-states.md`). EET 2.0 has no
storno message: a reversal is a new sale with a negative amount and no link
to the original.

`eetRefundsToReverseQuery` selects a refund of any device when its payment
has a supported sale and no reversal exists for it yet. The job skips it
while the payment has extra money no extra money sale reports yet. The
refund's device creates the reversal at once; other devices only after its
10 minutes, counted from the latest confirmation of the payment's supported
sales when that came after the refund. `createEetReversal` freezes:

| Field | Value |
|---|---|
| `amount` | the money the refund handed back: for a refund from the cash register the cash handed out (`refundCashRegister.handedAmount`, rounded to whole crowns, refund/0012), else, or for a cash refund an older version wrote without it, the refund amount (`deriveEetReversibleRefundAmount`). For a refund of goods all of it; for a tip refund (`refund.isTip`) all of it when the `reportedTipAmount` of the payment's sale (of one of them when two devices each created one) covers the tip refunded, else at most that reported tip. Both capped at what the payment's supported sales and extra money sales report together minus the payment's earlier supported reversals. A tip refund of a sale that reports no tip gets no reversal. Stored positive, sent negated (`-250.00`) |
| `saleAt` (`dat_trzby`) | the refund's `refundedAt` |
| `sequenceNumber` (`porad_cis`) | the refund id |
| `cashRegisterId` (`id_pokl`) | the device that recorded the refund |
| `eic`, `establishmentId`, `environment` | current settings at creation time |
| `unsupportedReason` | `disabled` if EET is off or not set up, `environment` if the current environment is not the sale's, `taxpayer` if the current EIC is not the sale's |

`eetReversalsToDeliverQuery` holds a reversal back until every supported
sale of its payment has a confirmation, so EET never gets the reversal
first. Delivery then follows the sale's rules: Web Lock
`eet-reversal-<id>`, the same outcome mapping, backoff, status, overdue and
manual retry. Manual retry never rewrites a reversal's frozen data.

Each refund shows its reversal status on the payment detail, and Settings →
EET lists unconfirmed reversals next to unconfirmed sales.

## Edge cases

| Case | Behavior |
|---|---|
| Payment claimed while EET was disabled | Never reported, even after enabling |
| Disable → re-enable | `enabledAt` moves forward; payments claimed before the new `enabledAt` whose sale was not created yet (device was offline/closed) are **never reported** |
| Disable with pending sales | Delivery continues; disabling only stops new sales |
| Claim removed after the sale was created | Sale still reported; no correction/storno is sent |
| Refund before the sale was created | The reversal is created once the sale exists |
| Refund of a payment with no sale or an unsupported sale | No reversal |
| Refund of a payment with a tip | A refund by amount or by items returns goods only, so its limit leaves the tip out; the tip has its own refund, which is reversed only when the sale reported the tip (tips belonged to the business) |
| Tip refund of a sale created before `reportedTipAmount` existed | No reversal; if the sale did report the tip, EET keeps it, which errs toward reporting more than was sold |
| Refund from the cash register of an amount with haléře | The refund records the exact amount; the storno carries the cash handed out, rounded to whole crowns, and of a whole refund the goods' storno takes the rounding of goods and tip together, so it is right whoever the tip belongs to. A rounding up past what the sales reported is cut by the cap |
| Tip entered as an amount while goods remain | Accepted and reversed as goods; the separate tip action and the dialog's note are what steer staff to the tip refund |
| Sale or extra money sale pending or rejected | The payment's reversals wait, for good if it is never confirmed |
| EET disabled, or environment or EIC changed, when the reversal is created | Reversal `unsupported`, never sent |
| Claim removed before creation | Not reported (query needs an active claim) |
| Overpaid / multiple claims | One sale for the first claim, capped at `payment.amount`, and an extra money sale for the rest; a refund of the extra money reverses only that |
| Two devices settle one payment while cut off from sync | One sale per settlement, each from its own device and cash register, and no extra money sale for either. A device that receives the other's settlement before that device's sale over-reports (see "Known gaps") |
| Refund before the extra money sale exists | The reversal waits for it, then covers the refund in full |
| Cash rounded or change left | The sale reports the cash received (78.90 charged, 79 or 80 received); the payment, its claim and the cash register keep 78.90 |
| Cash payment settled before the received amount was recorded | Reports `payment.amount` |
| First claim short of the amount | The sale reports what the claim brought; the rest becomes an extra money sale when it arrives, and is never reported if it never does |
| Non-CZK payment | `unsupported`, never sent |
| Recording device offline or lost | After 10 minutes another device of the account creates and delivers its records, marked as repeated |
| Recording device alive while EET is down | After 10 minutes other devices retry too; every later message is a repeat with the same body, so EET sees one sale |
| App closed while an attempt waits for its answer | The next attempt is a repeat and the record counts as possibly recorded by EET |
| Payment created on one device, paid in cash on another | The device that took the cash reports it, with its own `id_pokl` |
| Recording device and another create the same sale while cut off from sync | Same row id; if the settings changed in between, the merged row can mix two snapshots and its next resend would be a second sale |
| Certificate expires while enabled | Nothing stops creation/delivery; EET rejects; after replacing the cert every rejected sale must be retried one by one |
| Certificate replaced with a different EIC | Pending sales keep the old EIC but are signed with the new cert. Retry fixes the EIC only if all prior attempts were rejected |
| Environment switched while sales are pending | Each sale keeps its env: old playground sales still go to playground, signed with the new (maybe production) cert, and vice versa |
| Playground `.p12` uploaded as a file | Stored as a non-test certificate → can resolve to `production` |
| `production` sale synced into a build without production URL | Retries every 15 min forever |
| Two devices retry the same sale | Web Lock is per browser, not per account: both may submit; the confirmation row is last-write-wins |
| Clock skew | `claimedAt` and `enabledAt` come from different device clocks; a claim just after enabling can fall before `enabledAt`. A device clock more than 5 minutes ahead can take over before the recording device's last possible first sending |

## Known gaps

1. **No correction for removed claims.** Refunds are reversed (see
   "Refunds and storno"), but removed claims and canceled-but-paid payments
   have no negative sale path.
2. **Silent loss on re-enable.** The `claimedAt >= enabledAt` rule drops
   payments whose sale creation had not run before a disable/enable cycle.
   A persisted "disabled since/until" window would fix it.
3. **All payment methods are reported.** `method` is stored but unused; if
   some methods (e.g. bank transfer) should not be EET sales, nothing filters them.
4. **Expired certificate is not a gate.** Only the settings card warns
   (21 days ahead); nothing warns on the terminal, and sales keep failing.
5. **No bulk retry** of rejected sales after a configuration fix.
6. **Response verifier checks only** the signer's `O` field
   (`Generální finanční ředitelství`), validity dates and the signature — no
   chain to a trusted CA, so a self-signed cert with that `O` passes.
7. **Endless retry** with no cap and no escalation beyond the overdue badge.
8. **Private key syncs to every device** of the account (encrypted, but
   a compromised device leaks the signing key).
9. **Sale time = claim time**, not when the customer paid; for an IBAN
    transfer matched later by bank sync, `dat_trzby` is the match time.
10. **A settlement that syncs before its sale is reported twice.** When two
    devices settle one payment while cut off from sync, a device that
    receives the other device's settlement before that device's sale
    reports the settlement as extra money, and the other device's sale
    reports it too.
