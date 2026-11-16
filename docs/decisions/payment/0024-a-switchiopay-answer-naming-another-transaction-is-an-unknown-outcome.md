# 0024 A SwitchioPay answer naming another transaction is an unknown outcome

Status: accepted
Date: 2026-11-16

## Context

Every SwitchioPay request carries a `transactionId`, and the terminal's
answer can name the transaction it is about in its own `transactionId`. A
lookup (`get_transaction`, payment/0019, refund/0007) already reads an answer
about another transaction as unknown. The answer to a payment, a refund or
a reversal was not checked this way, whether it came through the launch's
promise or was restored after Android killed the app.

Payky launches SwitchioPay with the reorder-to-front flag the ECR docs
recommend, so a terminal that is already running can return an answer that
belongs to an earlier transaction. That answer was recorded as this
attempt's outcome. An approval from another transaction then settled this
payment and stored another payment's refund id with it, so a later refund
to the card would name the wrong transaction.

## Decision

An answer to a payment, a refund or a reversal is read against the request
it came back for. If it names another `transactionId`, it is an unknown
outcome, whether it approves or declines:

- A card payment keeps its attempt unresolved, so staff must confirm before
  charging again, and the terminal can be asked about the attempt
  (payment/0019).
- A refund keeps its attempt unknown (refund/0007).

The direct path compares the answer with the id of the request it
launched. The restored path compares it with the id stored with the result.

An answer that names no transaction is read as the request's, because the
field is optional in the ECR result structure. So is any answer to a
request whose id is not known, which is a result stored by a build that
kept none.

## Alternatives considered

- **Requiring the answer to name the request, as a lookup does.** A
  terminal that leaves the optional field out would then never complete a
  payment.
- **Reading a stale answer as a decline.** It says nothing of this attempt,
  and a decline would let staff charge again without confirming.

## Consequences

If a terminal echoes a transaction id that differs from the one it was
sent, for example a reformatted one, every one of its answers becomes
unknown. Staff would then confirm each retry until the comparison is
loosened.

## Enforced by

- `packages/core/src/switchio.test.ts > an answer naming another transaction (payment/0024) > is an unknown outcome: %s`
- `packages/core/src/switchio.test.ts > an answer naming another transaction (payment/0024) > is read as the request's when it %s`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > keeps an attempt unknown when its restored answer names another transaction (payment/0024)`
- `apps/native-app/src/platform/switchio-restore.test.ts > an answer naming another transaction (payment/0024) > is read against the request, not the module's echo of it, for a payment and a refund`
- `apps/web-app/src/platform/switchio.test.ts > an answer naming another transaction in Payky (payment/0024) > reads an answer naming another transaction as an unknown outcome`
