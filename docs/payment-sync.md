# Payment sync (FIO, MONETA, Spark, Cashu & LNURL verify)

How the FIO and MONETA (bank IBAN) and Spark (Bitcoin/Lightning) background
jobs turn
external activity into local data. Complements `docs/bill-payment-states.md`,
which covers what a `reconciliationClaim` means to a payment/bill; this
covers how one (and the `accountTransaction` behind it) gets created.

## Flow

Every job does the same two things per new item (FIO statement line /
MONETA transaction / Spark transfer) in one mutation batch:

1. **Find candidate** → match an unclaimed `payment` by method identifiers
   before writing, using the raw incoming item.
2. **Record + reconcile** → an `accountTransaction` row + kind detail row
   (`accountTransactionIban` / `accountTransactionSpark`+`Lightning`/
   `SparkInvoice`) plus the optional `reconciliationClaim` and bill
   `closedAt` cache. The claim makes a payment display **Paid**.

Already-recorded transactions still run the standalone reconciliation step to
repair rows created before this batching existed.

## Files

| File | Role |
|---|---|
| `background-jobs/background-job-types.ts` | `BackgroundJob`/`BackgroundJobContext` shape. |
| `background-jobs/background-jobs.ts` | Which jobs run on which runtime. |
| `background-jobs/run-background-jobs.ts` | Starts jobs, composes disposables. |
| `background-jobs/keyed-task-queue.ts` | Per-key sequential queue, used by every session below. |
| `background-jobs/reconcile-account-sync-sessions.ts` | Diffs active accounts/plugins against running sessions. |
| `background-jobs/jobs/fio-account-transaction-sync-job.ts` | The FIO job. |
| `background-jobs/jobs/moneta-account-transaction-sync-job.ts` | The MONETA job: a timer and the sync pointer around `syncMonetaTransactions`. |
| `moneta-plugin/moneta-plugin-actions.ts` | `syncMonetaTransactions` — MONETA's record and reconcile steps, shared by the job and the payment-wait screen. |
| `background-jobs/jobs/spark-account-transaction-sync-job.ts` | The Spark job. |
| `account-transaction/account-transaction-actions.ts` | `createAccountTransaction` — the record step. |
| `reconciliation-claim/reconciliation-claim-actions.ts` | `reconcileAccountTransaction` — the reconcile step. |
| `integrations/fio/fio-client.ts` | FIO HTTP client. |
| `integrations/moneta/moneta-client.ts` | MONETA VIP API client (ČOBS v7). |
| `features/payment-wait/use-moneta-payment-watch.ts` (web, native) | MONETA's fast speed on the payment-wait screen. |
| `spark/spark-wallet.ts` | Pooled, ref-counted Spark SDK wrapper. |
| `account/account.ts`, `account-spark-queries.ts` | `sparkAccountSyncPointer` table + query. |
| `components/app/app-background-jobs.tsx` | Starts/stops jobs once per app mount. |

## Parameters

| | FIO | MONETA | Spark |
|---|---|---|---|
| Trigger | per-plugin timer | per-plugin timer + the payment-wait screen | account-wide timer + wallet events (`transfer:claimed`, `balance:update`, `deposit:confirmed`) |
| Default interval | 30s (`numberOfSecondsBetweenChecks`) | 300s (`numberOfSecondsBetweenChecks`, at least 60s); 4s per page read on the payment-wait screen for its first 10 minutes (`moneta/0002`) | 60s (`DEFAULT_RECHECK_INTERVAL_MS`) |
| Sync pointer | `fioPluginSyncPointer.lastSyncedDate` | `monetaPluginSyncPointer.lastSyncedDate` (the job only) | `sparkAccountSyncPointer.lastSyncedAt` |
| Lookback overlap | `syncLookbackDays`, default **1 day**, per-plugin | none — the job reads from the pointer's day, the screen from the payment's day; the bank filters by `bookingDate`, whole days in Prague's time zone sent as bare dates (`moneta/0004`, `moneta/0008`) | `SPARK_SYNC_LOOKBACK_HOURS` = **72h**, fixed |
| Cold-start scan | 2 months back (`FIO_FIRST_SYNC_LOOKBACK_MONTHS`) | 2 months back (`monetaFirstSyncStartDate`), read a week per call, narrowed to a day when the bank lists more (`MONETA_SYNC_WINDOWS`), a day still too long passed and logged (`moneta/0006`), never past the two years a token reads (`earliestMonetaReadableDay`) | unbounded (full history) |
| Advisory lock key | `fio-transaction-{accountId}-{bankReference}` | none — deterministic ids only | `spark-transfer-{id}` |
| Queue keys per session | `"sync"` (single) | `"sync"` (single) | `"history"` + `` `transfer:${id}` `` (multi) |
| Manual pointer edit | Settings UI only | Settings UI + CLI (`apps/cli/src/cli-moneta-plugins.ts set/reset-sync-pointer`) | Settings UI + CLI (`apps/cli/src/cli-accounts.ts set/reset-spark-sync-pointer`) |

The FIO and Spark locks use `{ ifAvailable: true }` — skip on contention,
never wait. MONETA takes none: the job and an open payment-wait screen may
sync at once, and write the same rows. A second transfer for a paid payment
claims it too, so it overpays the payment however the two syncs interleave
(`moneta/0005`). All pointers are wall-clock values (sync start time), not derived from any
record's own timestamp, so a quiet sync still advances the window forward.

FIO and MONETA record a statement through the same steps
(`reconciliation-claim/bank-sync-actions.ts`): the bank references already
recorded are read in one query, the new transactions are written in shared
batches — a transaction that claims a payment closes its batch, so the next
one's candidate lookup sees the claim — and the recorded but unclaimed ones
are re-checked in one query that names the few a payment matches. A
MONETA window the bank lists more pages for than one sync reads
(`MONETA_MAX_PAGES`) is read again a day at a time to its end, then a
week again (`moneta/0007`). The bank filters by
date alone, so no narrower request reads more of a day: one still too long
is passed with what was read of it and logged, rather than retried against
the daily limit (`moneta/0006`).

FIO and MONETA only run native/CLI (no CORS/proxy for browser,
`moneta/0001`); Spark runs everywhere. A MONETA token the bank refuses stops
the job's calls until the plugin changes, and an exceeded daily limit
(5000 calls a token) backs it off; both stop the payment-wait screen's
check for the rest of the wait.

## Multi-device & idempotency

A FIO or MONETA plugin / Spark account is normal synced Evolu data — every device
independently runs its own sync job for it, with no leader election. Safety
comes from convergence, not coordination:

- `accountTransaction.id` derives from `accountId` + bank reference (FIO,
  MONETA's `entryReference`) or
  `sparkTransferId` (Spark) — two devices recording the same thing write the
  same CRDT row.
- `reconciliationClaim.id` derives from `` `{source}:${paymentId}:${accountTransactionId}` ``
  — same reasoning.
- The advisory locks above are **per-device only**; they mainly guard a
  session against itself (e.g. old/new session overlap after a token or
  secret change), not against other devices.

## Reconciliation

`reconcileAccountTransaction(id)`: return the existing claim if one's
active; else run these three candidate queries in parallel (`kind` picks at
most one winner) and claim the first match, ties broken by `payment.id`:

| Kind | Match | Reachable from these jobs? |
|---|---|---|
| `iban` | account + variable symbol (+ specific symbol, or both null) + amount + currency | yes |
| `spark` | account + `BTC` + amount(sats) + Lightning or Spark invoice match | yes |
| `cashRegister` | account + amount + currency | no — only `markPaymentPaidCash` creates this kind |
| `cashu` | account + mint + the payment's quote id, or the receive id it holds; never the amount | yes — the Cashu job |
| `lightningAddress` | not matched: the verify poll knows its payment and claims it directly | yes — the LNURL verify job, below |

No match = transaction stays unclaimed; not an error. A paid payment is no
candidate, except for a MONETA transfer that matches no unpaid one: that
claims it anyway and overpays it (`moneta/0005`). A claim also refreshes
the bill's `closedAt` cache in the same batch (see `bill-payment-states.md`).

## Cashu

`background-jobs/jobs/cashu-account-sync-job.ts` serves the Cashu account
(`cashu.md` §5, the `cashu/` decisions). It runs on native and browser, not
in the CLI, and only while the Cashu account is enabled. The wallet is
Linky's own, read and written through `core/cashu/cashu-shard-store.ts`.

| Part | What it does |
|---|---|
| Lightning settlement | Every 5 s it polls the pending `topup` operations Payky's payments hold (and recent `autoswap`s) on Linky's schedule — 5 s for 5 minutes, 1 minute up to an hour, then 5 minutes — and claims a paid quote (`claimCashuTopup`). A claim made elsewhere is waited for; after 5 minutes it is reclaimed from the synced counter. |
| Melts | Melts this device sent that are still `pending` are resumed (`resumeCashuMelt`); a withdrawal's movement or failure follows (`settleCashuWithdrawal`). |
| Tokens | `core/cashu/cashu-token-listener.ts` reads 1:1 NIP-17 messages with a token (7-day window), matches them to a payment, makes the payment hold the receive id, and receives the token; a message whose mint is down is retried every 30 s. |
| Booking | `core/cashu/cashu-booking.ts` turns every `done` incoming operation into one `accountTransaction` (+ `accountTransactionCashu`) with the automatic claim in the same batch. It reads only changes newer than the `_cashuBookingCursor` rowid in `evolu_history`; without a cursor it books the last month. Triggered on start, on any wallet change, and every minute. |

Multi-device safety comes from Linky's rules, not locks: operation ids derive
from the mint and quote (or the token text), the claim stops when someone else
got there first (`cashu/0004`), and the booked transaction's id derives from
the operation id.

## LNURL verify

`background-jobs/jobs/lightning-address-verify-job.ts` settles payments
taken into the merchant's own wallet through a Lightning address (the
`lightning-address/` decisions). Nothing arrives from the wallet: Payky
asks. It runs on native and browser (the wallets answer cross-origin), not
in the CLI.

| Part | What it does |
|---|---|
| Work | `unsettledLightningAddressPaymentsQuery`: every `paymentLightningAddress` row without a preimage, on a payment not deleted and not claimed another way. A row is dropped a day after its invoice expired. |
| Poll | `syncLightningAddressPayment` asks the invoice's LUD-21 verify URL: first after 2 s, then doubling up to a minute, and at once on reconnect. The wait screen polls every 2 s besides. |
| Proof | Paid only when verify answers for the stored invoice with a preimage whose SHA-256 is its payment hash (`lightning-address/0002`); `settled` without one writes nothing and the wait screen warns. |
| Record | One batch: `accountTransaction` (kind `lightningAddress`, sats) + `accountTransactionLightning` (invoice, hash, preimage), the automatic claim and bill `closedAt`, and `paymentLightningAddress.preimage`. |

Multi-device safety comes from the ids, not locks: the transaction's id
derives from the account and the payment hash, the claim's from the payment
and the transaction, so two devices that saw the same preimage write the
same rows.

Which wallets reveal the preimage is known only from real payments. From
research before the implementation: Alby's callback
returns `verify` and allows any origin; Blink, Breez and Minibits answer
their metadata to any origin, Coinos echoes the origin. ZEUS Pay's verify
carries no preimage, so its payments never settle; Wallet of Satoshi is
expected to return no `verify` and be refused on save. None of these has
been tried against a real payment yet: record each one that is, here, not
in the UI.

## Known limitations

| # | Issue | Status |
|---|---|---|
| 1 | Spark transfer with no Lightning/Spark invoice | open by design — never recorded |
| 2 | Ambiguous candidate ties | open — `payment.id` order decides |
| 3 | MONETA pending (`PDNG`) transfer | by design — recorded only once booked (`moneta/0003`) |
| 4 | MONETA day with more bookings than one sync reads | by design — passed with what was read, logged (`moneta/0006`) |

1. **By design**, not a bug: `assertHasSparkIdentifier` is a domain
   invariant enforced inside `createAccountTransaction` itself.

2. **Ties.** IBAN candidate: same VS/SS/amount on two open payments. Cash
   candidate: same amount (currently unreachable, see the table above).

3. **MONETA `PDNG`.** Only a booked transfer is recorded (`moneta/0003`),
   so a recorded one is final and its `entryReference` never changes. A
   pending entry may be booked under another reference — the reference
   carries the booking date — and recording it would count the money twice.
   Incoming transfers seen on a live account were listed as `BOOK` at once.

4. **A too-busy MONETA day.** One sync reads at most `MONETA_MAX_PAGES`
   pages, and the bank filters by date alone, so no narrower window reads
   more of a day. The job records what it read, moves its pointer past the
   day and logs an error (`moneta/0006`). The bank lists the newest first,
   so a job that syncs often still reads what arrived since its last sync.
