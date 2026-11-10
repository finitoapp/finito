# 0007 A written line takes the tax rate the owner sets

Status: accepted
Date: 2026-11-08

## Context

A guest's written order became a line with no tax rate, as a keypad amount
is (menu-ordering/0004). A VAT payer's tax recap then counted it untaxed, so
0004 told a VAT payer to keep writing off, and nothing kept one from switching
it on.

## Decision

The owner picks one tax rate for written lines, beside the switch that offers
writing (`appSettings.writtenOrderTaxRateId`). The device that takes orders
gives each written line the rate set when the money arrives. A VAT payer's
menu offers no writing until a rate is set, so a guest of a VAT payer never
writes a line without one. An account that is no VAT payer may leave it unset.

## Alternatives considered

- Keeping writing off for a VAT payer. Most places that would use it pay VAT.
- Staff splitting a written line into rates when they accept it. Nothing in
  Payky changes a line's rate today, so it would be a feature of its own, for
  both apps.
- The guest picking food or drink. It asks the guest to know the tax rules.

## Consequences

A written order of mixed rates is taxed at the one rate. A guest who wrote on
a menu version from before the rate was cleared still pays a line without one.

Staff can switch each written item to another rate until they accept the
order (`menu-ordering/0012`).

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > the tax rate of a written line > is the one the owner set for written lines`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > the tax rate of a written line > is needed before a VAT payer's guests can write`
- `apps/web-app/e2e/written-orders.spec.ts > a VAT payer's guests can write once the owner picks the tax rate of a written line`
