# 0011 Self-pay starts at about one koruna, or at everything left

Status: accepted
Date: 2026-10-16

## Context

The merchant device credited a self-pay only from one major unit of the
bill's currency. That is 1 CZK on a koruna bill but about 25 CZK on a euro
or dollar bill, and nothing could pay a remainder below it, such as the last
0.40 CZK of a bill, so staff settled it at the till. The minimum exists only
to make a flood of tiny payments cost real money, since each payment is a
row every device syncs and a sale EET hears of (`eet/0001`).

## Decision

The self-pay minimum is about 1 CZK in every currency: 1.00 CZK, 0.05 EUR and
0.05 USD, from a fixed table (`selfPayMinimum`). Lightning money is compared
after its conversion at the signed rate. Money below the minimum still counts
when the bill owes something and the money covers all of it
(`meetsSelfPayMinimum`). The bill is read without the payment this very
money made, so every device decides the same.

A share that would leave the bill owing more than zero and less than the
minimum is the whole remainder instead (`calculateSelfPayShare`), on the
guest page and on the merchant device alike, and so is a typed amount above
what the bill owes. The page says it added the rest. A share below the minimum that is not everything left cannot be paid,
and the page says where paying starts.

Money that creates no payment is never reported to EET.

## Alternatives considered

A minimum of one minor unit or one satoshi. A thousand payment rows, each
synced to every device and reported to EET, would cost a few korunas.

A minimum converted at a live exchange rate. The guest page and every
merchant device would have to fetch and agree on that rate.

Disabling the pay button when a share would leave less than the minimum. It
forbids the same remainder, but hands the guest a decision and a second try.

## Consequences

A flood on a euro or dollar bill costs about 1 CZK per payment, as on a
koruna bill. The merchant keeps the money.

A remainder staff leave at the till stays payable by self-pay. Two merchant
devices that match two small payments of one remainder before they sync both
credit them, and the bill is overpaid by at most the minimum per device.

A guest who types an amount can pay up to the minimum more than they typed,
always money the bill still owes, and never more than it owes.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > the self-pay minimum > is about one koruna in every currency`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > the self-pay minimum > lets money below it count only when it covers everything left`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > calculateSelfPayShare > an amount that would leave less than the minimum pays the whole remainder`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > calculateSelfPayShare > an amount above what the bill owes pays the whole remainder`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > calculateSelfPayShare > items that would leave less than the minimum take the rest of the bill`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > credits the last 0.40 CZK of a bill, the same way once it is recorded`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > leaves 0.40 CZK unmatched once the bill is paid`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > credits the last 0.40 CZK of a bill by Lightning`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > credits 0.50 EUR on a euro bill, above the euro minimum`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > ignores a flood of one-satoshi payments`
- `packages/core/src/modules/table-self-pay/table-self-pay-eet.test.ts > self-pay in EET > money too small to match a bill is never reported`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest pays at least five cents, or everything left on the bill`
