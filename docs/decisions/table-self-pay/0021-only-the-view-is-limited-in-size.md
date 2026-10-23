# 0021 Only the view is limited in size

Status: accepted
Date: 2026-10-22

## Context

Two things a guest relies on have a size: the payment's message and the
relay event that carries the view. QR Platba allows 60 characters of
message
([standard](https://qr-platba.cz/wp-content/uploads/QR_platba_standard_CBA.pdf)),
Spark 120 bytes of Lightning description
([docs](https://docs.spark.money/wallets/deposit-from-lightning)), and the
default relays accept events of about 64 KiB. The payment points to the
selection (`table-self-pay/0020`), so only the view grows with the bill.

## Decision

The payment carries `PK1` and a 32-character pointer, 35 characters in the
bank message and at most 108 bytes in the Lightning description. Whatever
the guest selects fits, however many lines it names.

The view must fit one relay event:
- When its encrypted content passes 60 KiB, bills are published by their
  totals only, the one with the most lines first, until the view fits.
- When every bill is shown by its totals and the view still does not fit,
  the newest bills are left out.

A guest on a bill shown by its totals pays the rest of it, a fraction or an
amount.

## Alternatives considered

None recorded.

## Consequences

A guest who splits a long bill line by line can pay any selection, unless
the bill itself is shown by its totals.

Revisit when real tables regularly have bills shown by their totals only.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-reference-utils.test.ts > bank message > is PK1 and the pointer in 35 characters, one line of a Czech interbank message`
- `packages/core/src/modules/table-self-pay/table-self-pay-reference-utils.test.ts > Lightning memo > fits the pointer, a twelve-digit amount and a fifteen-digit rate into 108 of the 120 bytes`
- `packages/core/src/modules/table-self-pay/table-self-pay-view-utils.test.ts > self-pay view event > four bills of 64 lines publish under 64 KiB with the largest bills by totals`
- `packages/core/src/modules/table-self-pay/table-self-pay-view-utils.test.ts > self-pay view event > leaves out the newest bills when bills by totals still do not fit`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest pays a third of a bill too long to list by Lightning and sees it confirmed`
