# 0031 Spark money is recorded when its transfer arrives, before the claim

Status: accepted
Date: 2026-11-25

## Context

The Spark sync job recorded an incoming transfer only once it was
`COMPLETED`: on `transfer:claimed`, or on the sweep after the claim
(payment/0030). The SDK claims a transfer as soon as its event stream
delivers it, and the claim is about 5 s of signing on the JS thread of a
PAX A920Pro (payment/0030, finitoapp/finito#275). `transfer:claimed` comes
later still: the SDK first awaits `getBalance`, which asks every operator
and syncs token outputs. The stream delivered the transfer seconds earlier,
while the payment screen kept waiting. Per the Spark protocol only this
wallet can claim a transfer once its sender tweaked its keys; this is to be
confirmed with Lightspark.

Measured on a PAX A920Pro with two payments to a Spark invoice: recording
on the stream's announcement showed the payment paid 1.4 s after the stream
delivered it, where the claim alone took 5.5 s and the sweep after it
another 5 s. Of the 1.4 s, 0.6 s was an SSP call that brings nothing for a
plain transfer, and the sweep after the claim found only the transfer
recorded already.

## Decision

- The Spark wallet wrapper (`pooledWallet` in `spark/spark-wallet.ts`)
  announces `transfer:incoming` for a transfer to this wallet the stream
  delivers, before the SDK starts its claim: not a self transfer, of type
  `TRANSFER` or `PREIMAGE_SWAP` (no counter swap), in a status the SDK
  claims from (`SENDER_KEY_TWEAKED`, `RECEIVER_KEY_TWEAKED`,
  `RECEIVER_REFUND_SIGNED`, `RECEIVER_KEY_TWEAK_LOCKED`,
  `RECEIVER_KEY_TWEAK_APPLIED`, the SDK's
  `partitionClaimablePendingTransfers`). A `PREIMAGE_SWAP` comes with its
  SSP user request, one SSP call beside the claim. A `TRANSFER` carries its
  Spark invoice itself and is mapped on the device with the SDK's public
  `mapTransferToWalletTransfer`, with no call.
- The sync job records such a transfer at once, on a queue of its own, so it
  never waits behind a sweep: the same rows as a completed one gets, the
  account transaction with its Spark detail, the automatic reconciliation
  claim and the bill's `closedAt`, in one batch. A Lightning transfer needs
  its invoice and preimage from the user request; without them it is left
  to the sweep after `COMPLETED`.
- The SDK's claim of an announced transfer waits until the sync job
  recorded it, at most 3 s (`CLAIM_HOLD_MAX_MS`): its signing would
  otherwise take the JS thread from the record, which then took 1.4 s.
- Every other path (the sweeps, `transfer:claimed`, the withdrawal check of
  withdraw/0002) still records `COMPLETED` transfers only.
- On `transfer:claimed` the job looks the transfer up in Evolu first, and a
  recorded one is only reconciled, not fetched from the operators and the
  SSP.
- EET is unchanged: a sale is reported on the reconciliation claim, which
  now comes before the transfer completes.
- The sweeps, as payment/0030 set them, with one exception. A
  `balance:update` with an amount incoming starts no sweep: the claim it
  announces ends in another `balance:update`, with nothing incoming. That
  one sweeps, unless a transfer was announced since the last such update
  and every transfer announced since is recorded: then the claim that ended
  is theirs and the sweep would find nothing new. Otherwise a sweep runs
  every minute, on every other `balance:update` and on `deposit:confirmed`.
  It reaches back 72 hours before the pointer on the session's first sweep,
  when 30 minutes have passed since the last such sweep
  (`SPARK_FULL_SWEEP_INTERVAL_MS`), and after `deposit:confirmed`; the
  sweeps in between look back the last hour
  (`SPARK_RECENT_SWEEP_LOOKBACK_MS`). Only a full sweep moves the pointer
  (payment/0026). A sweep asks which transfers of a page are recorded
  already, and which of them a payment claims, in one query.

## Alternatives considered

- A signal for the payment screen only, recording at `COMPLETED` as before.
  Rejected: for those seconds the screen would say paid while the bill stays
  open and the books lack the money.
- EET waiting for the transfer to complete. Rejected for now: it is only
  useful together with reversing a record whose claim never completes,
  which is out of scope.
- Taking the pending transfer ids from `queryPendingTransfers` on
  `balance:update` instead of wrapping a private SDK method. Rejected: one
  more round trip before the record. It stays the fallback should the
  wrapper become unmaintainable.

## Consequences

- A transfer recorded before its claim whose claim never completes (it ends
  `EXPIRED` or `RETURNED`) stays recorded, its bill closed and its sale
  reported to EET. Reversing it (deleting the transaction, reopening
  the bill) is a future change. A claim that is only
  late (the app offline or killed) the SDK finishes itself.
- The claim, and the money's arrival in the wallet's balance, comes as
  much later as the record takes, at most 3 s. The SDK's stream loop awaits
  each event's handling, claim included, so while the claim waits it
  delivers no further event, as it delivers none during the claim itself;
  both stay well inside its 15 s heartbeat timeout.
- For a few seconds the recorded money exceeds the wallet's balance.
  Withdrawals read the wallet's balance, so nothing can be withdrawn before
  the claim.
- Every device of the account gets the stream event and records the same
  rows; their ids derive from the transfer id, so they converge on one row.
- The wrapper depends on the SDK's private `handleStreamEvent` and, for a
  Lightning transfer, `constructTransfersWithUserRequest` (SDK 0.14.0), held
  by a contract test against the real SDK. Vitest loads its node build, so
  the test cannot vouch for the React Native build Finito runs.
- `mapTransferToWalletTransfer` comes from `@buildonspark/spark-sdk/types`,
  loaded with the SDK when a wallet is created. On React Native that subpath
  is a second copy of the SDK's protobuf code, about 660 KB of the bundle.
- A balance settled by something else in the same window as the claim of
  recorded transfers, a withdrawal finishing, say, loses its sweep to the
  minute's.
- A claim that fails leaves its transfer to the minute's sweep, and to the
  SDK, which tries again every 10 s on React Native.
- This supersedes payment/0030, whose sweeps it keeps but for the one
  exception. withdraw/0002 stands as it is.

## Enforced by

- `packages/core/src/spark/spark-wallet.test.ts > Spark wallet incoming transfers > announces an incoming transfer before the SDK claims it`
- `packages/core/src/spark/spark-wallet.test.ts > Spark wallet incoming transfers > does not announce a self transfer or a counter swap`
- `packages/core/src/spark/spark-wallet-sdk-contract.test.ts > the SDK still has the stream handler the incoming announcement wraps`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > records an incoming transfer as soon as it arrives, before its claim`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > records an arriving transfer without waiting behind a sweep`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > leaves an arriving Lightning transfer whose request the SSP does not return yet to the sweep after it completes`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > checks a recorded transfer locally before fetching it on transfer:claimed`
- `packages/core/src/spark/spark-wallet.test.ts > Spark wallet incoming transfers > announces a Spark transfer without asking the SSP`
- `packages/core/src/spark/spark-wallet.test.ts > Spark wallet incoming transfers > holds the SDK's claim of an announced transfer until its subscriber recorded it`
- `packages/core/src/spark/spark-wallet.test.ts > Spark wallet incoming transfers > claims an announced transfer after 3 s when its subscriber has not recorded it`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > settles what the wallet holds the claim for once the announced transfer is recorded`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > skips the sweep after a claim once its announced transfer is recorded`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps after a claim whose announced transfer was not recorded`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps on a balance update only once nothing is incoming, after the claim`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps the last hour every minute and the 72 hours before its pointer every half hour`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps the 72 hours again once a deposit is confirmed, as its transfer may be older than an hour`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > checks a page of recorded transfers in one query, without taking each transfer's lock`
