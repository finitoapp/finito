# 0032 The payment screen shows Paid on the Spark job's signal

Status: accepted
Date: 2026-11-26

## Context

Since payment/0031 the Spark sync job records an arriving transfer before
its claim. On a PAX A920Pro the payment screen still showed Paid 0.36 s
after the stream delivered a Spark transfer, 1.0 s for a Lightning one
(0.56–0.65 s of it the SSP call). After the record the job looked the
payment up by its invoice in Evolu, wrote, awaited the commit, and only
then did the screen's own queries see the claim, derive the status and
render. The screen knew all along which payment it was waiting for.

## Decision

- The payment screen (both apps) registers the payment it waits for with
  the Spark sync job (`createAwaitedPayments` in
  `background-jobs/awaited-payments.ts`, one per app, in memory only): its
  Spark account, amount in sats and Lightning or Spark invoice. Only while
  the payment is pending and has an invoice; leaving the screen, a status
  change or a new invoice ends it.
- The job takes the payment from a registration that matches what
  `sparkReconciliationCandidateByValuesQuery` matches (account, amount and
  invoice) and skips that query. Without a match it queries as before. The
  bill's `closedAt` is still read at the record.
- The job signals a registered payment as soon as its rows are queued with
  Evolu, before the commit, on every record path. The screen shows Paid on
  the signal, ahead of its derived status, and ahead of a cancellation that
  lands in between.

Measured on the PAX: Paid 0.17 s after the stream event for a Spark
transfer, 0.75 s for a Lightning one.

## Alternatives considered

- The payment id in the invoice's description or memo, so the transfer
  carries it. Rejected: the payer sees it, the job still has to check the
  amount and the payment, and it does not help the bill's closing.
- A subscription the job holds on every pending payment. Rejected: it
  reruns on every payment write, on the JS thread the PAX is short of, to
  serve the one payment a screen already knows.

## Consequences

- A commit that fails after the signal leaves the screen on Paid with
  nothing written; the error is logged. Same class of risk payment/0031
  accepted for the claim.
- The commit now runs while the screen renders Paid and takes about 0.6 s
  on the PAX, so the claim, which waits for the record (payment/0031),
  starts that much later. Paid renders before the claim starts.
- Another device, or a payment no screen awaits, is recorded through the
  query as before.

## Enforced by

- `packages/core/src/background-jobs/awaited-payments.test.ts > createAwaitedPayments > finds a registration only by account, amount and invoice`
- `packages/core/src/background-jobs/awaited-payments.test.ts > createAwaitedPayments > recorded runs the callback once and removes the registration`
- `packages/core/src/background-jobs/awaited-payments.test.ts > createAwaitedPayments > disposing removes the registration without the callback`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job, awaited payments > records an awaited payment's claim without querying for candidates, and signals it`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job, awaited payments > queries for candidates when no registration matches, and still signals the payment it finds`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job, awaited payments > signals once the mutation is queued, before it completes`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job, awaited payments > sends no signal for a duplicate or an ignored transfer`
- `packages/app-shared/src/awaited-payment.test.ts > awaitedPaymentFor > awaits a pending payment with an invoice`
- `packages/app-shared/src/awaited-payment.test.ts > awaitedPaymentFor > awaits nothing once the payment is no longer pending`
- `packages/app-shared/src/awaited-payment.test.ts > awaitedPaymentFor > awaits nothing without an invoice, a Spark account or sats`
