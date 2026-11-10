# 0025 A test deployment takes test transfers in place of the bank

Status: accepted
Date: 2026-11-10

## Context

Trying self-pay end to end meant sending real money: a bank transfer the
till's FIO or MONETA sync picks up, or a Lightning payment. Each test cost a
real payment and the minutes a bank takes, and a deployment without a bank
connection could not test the bank path at all.

## Decision

A deployment whose configuration sets `VITE_PAYKY_SELF_PAY_TEST_TRANSFERS`
(the web app and its guest page) or `EXPO_PUBLIC_PAYKY_SELF_PAY_TEST_TRANSFERS`
(the native app) to `true` takes test transfers. The guest page offers a
Test payment method that sends what the bank QR asks for: the amount, the
bill's reference as the variable symbol and the `PK1` message with the
guest's pointer. The till books each one as a transaction of its bank
account and matches it through the same code a bank sync uses. Both default
to `false`.

## Alternatives considered

A button on the till that marks money as arrived: rejected, the till does
not know a guest's pointer until money names it (table-self-pay/0020), so
staff would have to copy it from the guest's phone. A fake bank API the till
polls: rejected, it needs a server holding state, and the guest page has
none.

## Consequences

Every guest of the account signs test transfers with one key derived from
the selection key, so the till can list them; a sticker holder can mark any
amount as arrived. That is the one input without its own proof
(`docs/table-self-pay-design.md`, "Proof instead of permission"), which is why only a test deployment's configuration turns it on and
production leaves both variables unset. Test transfers show on the till as
bank transactions, with a bank reference starting `test-`.

## Enforced by

- `packages/core/src/background-jobs/background-jobs.test.ts > getBackgroundJobsForRuntime > runs the self-pay test transfer job only where a test deployment asks for it`
- `packages/core/src/background-jobs/jobs/self-pay-test-transfer-job.test.ts > recordSelfPayTestTransfers > credits the bill a test transfer names, as the same bank transfer would`
- `packages/core/src/background-jobs/jobs/self-pay-test-transfer-job.test.ts > recordSelfPayTestTransfers > books a test transfer once, however often the till looks`
- `packages/core/src/modules/table-self-pay/table-self-pay-test-transfer-utils.test.ts > self-pay test transfers > ignore what another account's guest or a forger sent`
