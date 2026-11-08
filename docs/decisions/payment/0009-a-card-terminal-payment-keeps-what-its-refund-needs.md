# 0009 A card terminal payment keeps what its refund needs

Status: accepted
Date: 2026-11-08

## Context

Finito is to refund SwitchioPay card payments to the card (plan
`docs/plans/switchio-refund.md`). The ECR protocol (v6.19.0) offers a
referral refund, which names the original payment by the `refundId` its
result carried (section 5.17, SwitchioPay 3.1.2 and later), and a reversal,
which only the phone whose SwitchioPay took the payment can make, and only
until that batch is closed (section 5.13). The result documents `refundId`
as a `long`, and a referral refund wants it 18 digits long, which a
JavaScript number cannot hold exactly. A payment's `deviceId` is the device
that created it, but a pending payment can be reopened from its detail and
paid by card on any device. A payment that does not keep these when it is
paid can never be refunded to the card: the terminal gives them out only
with the result.

## Decision

An approved SwitchioPay payment keeps three more things on
`paymentCardSwitchio`, written with the rest of the result:

- `refundId`, read from the raw result text as the terminal's digits, never
  through a JavaScript number, so `JSON.parse` cannot round it. A missing
  or non-numeric one is left empty, and that payment cannot be refunded to
  the card.
- `deviceId`, the phone whose SwitchioPay charged the card, not the payment's
  `deviceId`.
- `approvedAt`, when that phone recorded the approval, by the same clock
  that stamps its `cardSwitchioClosure.closedAt`, so whether its batch was
  closed since can be decided without comparing two devices' clocks. The
  same result recorded again (its promise, then the copy restored after a
  restart) keeps the first time.

Payments taken before this are not backfilled; they are refunded in cash or
outside the app.

## Alternatives considered

Reading `refundId` as a number and storing it as text, which rounds an
18-digit id before any schema sees it. Taking the charging phone from the
payment's `deviceId`, which names the wrong phone for a payment paid on
another device, or from the card account transaction's source, which hides
a refund's precondition behind a join through claims. Comparing a closure
with the account transaction's time, which another device could have
written.

## Consequences

Web (Payky) records the same columns for its own SwitchioPay payments, since
the reading lives in core. A refund flow can be built on these alone, and
until it is, they are only kept.

## Enforced by

- `packages/core/src/switchio.test.ts > interpretSwitchioPaymentResult > keeps an 18-digit numeric refund id digit for digit, past what a number holds`
- `packages/core/src/switchio.test.ts > interpretSwitchioPaymentResult > takes a quoted refund id as it is`
- `packages/core/src/switchio.test.ts > interpretSwitchioPaymentResult > leaves the refund id out when the terminal sends none or no digits`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > keeps what a refund to the card needs: the terminal's refund id, the phone that charged the card and when`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > keeps the first approval time when the same result is recorded again after a restart`
