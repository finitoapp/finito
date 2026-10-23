# 0018 A custom tip is typed in the currency

Status: accepted
Date: 2026-10-22

## Context

The custom tip on the guest page read a typed number as a percent unless
the guest switched it to an amount, and the switch stood after the field.
A review on 2026-10-20 typed 50 on a share of 288.00 CZK and got a tip of
144.00 CZK. A guest who types a custom tip usually has a sum in mind, the
way people round up or hand over a note. Text the page could not read
counted as no tip, and nothing said so.

## Decision

A custom tip is read as an amount in the bill's currency. The guest can
switch it to percent, and the switch stands before the field, the currency
first. Text that is neither an amount nor a percent is named at the field
with an example, and the pay button stays off until the guest fixes it.

The preset tips stay percentages of the share, as `table-self-pay/0019`
lists them.

## Alternatives considered

Keeping percent as the default and moving only the switch. It keeps the
surprise for anyone who does not look at the switch.

Guessing the unit from the size of the number. A 15 is a sensible percent
and a sensible amount alike.

## Consequences

A typed 10 adds 10 of the currency. The tile says "% or amount", and the
unit shows inside the field.

## Enforced by

- `apps/web-app/src/features/table-self-pay-guest/guest-tip-picker.test.ts > a custom tip typed as 50 is 50.00 of the bill's currency`
- `apps/web-app/src/features/table-self-pay-guest/guest-tip-picker.test.ts > a custom tip switched to percent reads 5 as five percent of the share`
- `apps/web-app/src/features/table-self-pay-guest/guest-tip-picker.test.ts > a custom tip that cannot be read is named instead of counting as no tip`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest sees what each choice and tip costs before paying`
