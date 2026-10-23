# 0017 Guests see the payee name the owner chose

Status: accepted
Date: 2026-10-22

## Context

The table's view named the bank account as the payee, and the bank QR
named it as the recipient. Onboarding stores the account's name as data,
in English, so a Czech guest read "Paying Fiat bank account": an internal
label of the till, not the name of the place they sat in. The legal entity
holds only the country and the VAT status, so the app knew no name meant
for guests.

## Decision

The owner chooses one name guests see, for the whole account, in the
tables settings. It is empty by default. The view carries that name as the
payee and the bank QR carries it as the recipient. While no name is chosen,
the view names no payee, the guest page shows no payee line and the QR
names no recipient. The name of a payment account never reaches a guest.
PAY by square 1.2.0 requires a beneficiary name, so while no name is
chosen the guest's PAY by square QR is version 1.0.0, also when the bank
account's format is 1.2.0. The fallback of payment/0005 to the payment
method's name never reaches a guest. Payment/0005 still governs the QR the
till shows.

## Alternatives considered

The account's name, as before. It is exactly the internal label that
reached guests.

A trade name on the legal entity. It would be a new onboarding question for
every account, also for those that never take payments at the table.

## Consequences

A bank transfer from a guest names no recipient until the owner chooses a
name, which a guest's bank accepts for a QR payment.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-actions.test.ts > the payee guests see > is no one while the owner has chosen no name, never the account's name`
- `packages/core/src/modules/table-self-pay/table-self-pay-actions.test.ts > the payee guests see > is the name the owner chose for guests`
- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > paying by bank transfer > names no recipient while the owner has chosen no name for guests`
- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > paying by bank transfer > picks a PAY by square version that accepts %s for guests`
- `apps/web-app/e2e/self-pay-payee.spec.ts > a guest sees no payee until the owner names one for guests`
