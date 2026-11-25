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

## Decision

- The Spark wallet wrapper (`pooledWallet` in `spark/spark-wallet.ts`)
  announces `transfer:incoming` for a transfer to this wallet the stream
  delivers, before the SDK starts its claim: not a self transfer, of type
  `TRANSFER` or `PREIMAGE_SWAP` (no counter swap), in a status the SDK
  claims from (`SENDER_KEY_TWEAKED`, `RECEIVER_KEY_TWEAKED`,
  `RECEIVER_REFUND_SIGNED`, `RECEIVER_KEY_TWEAK_LOCKED`,
  `RECEIVER_KEY_TWEAK_APPLIED`, the SDK's
  `partitionClaimablePendingTransfers`). The transfer comes with its SSP
  user request, one SSP call beside the claim; SDK 0.14.0 makes it for a
  plain transfer too.
- The sync job records such a transfer at once, on a queue of its own, so it
  never waits behind a sweep: the same rows as a completed one gets, the
  account transaction with its Spark detail, the automatic reconciliation
  claim and the bill's `closedAt`, in one batch. A Lightning transfer needs
  its invoice and preimage from the user request; without them it is left
  to the sweep after `COMPLETED`.
- Every other path (the sweeps, `transfer:claimed`, the withdrawal check of
  withdraw/0002) still records `COMPLETED` transfers only.
- On `transfer:claimed` the job looks the transfer up in Evolu first, and a
  recorded one is only reconciled, not fetched from the operators and the
  SSP.
- EET is unchanged: a sale is reported on the reconciliation claim, which
  now comes before the transfer completes.

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
- For a few seconds the recorded money exceeds the wallet's balance.
  Withdrawals read the wallet's balance, so nothing can be withdrawn before
  the claim.
- Every device of the account gets the stream event and records the same
  rows; their ids derive from the transfer id, so they converge on one row.
- The wrapper depends on the SDK's private `handleStreamEvent` and
  `constructTransfersWithUserRequest` (SDK 0.14.0), held by a contract test
  against the real SDK. Vitest loads its node build, so the test cannot
  vouch for the React Native build Finito runs.
- payment/0030 and withdraw/0002 stand as they are.

## Enforced by

- `packages/core/src/spark/spark-wallet.test.ts > Spark wallet incoming transfers > announces an incoming transfer before the SDK claims it`
- `packages/core/src/spark/spark-wallet.test.ts > Spark wallet incoming transfers > does not announce a self transfer or a counter swap`
- `packages/core/src/spark/spark-wallet-sdk-contract.test.ts > the SDK still has the stream handler the incoming announcement wraps`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > records an incoming transfer as soon as it arrives, before its claim`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > records an arriving transfer without waiting behind a sweep`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > leaves an arriving Lightning transfer whose request the SSP does not return yet to the sweep after it completes`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > checks a recorded transfer locally before fetching it on transfer:claimed`
