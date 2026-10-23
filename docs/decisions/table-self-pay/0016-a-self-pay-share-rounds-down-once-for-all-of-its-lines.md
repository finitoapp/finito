# 0016 A self-pay share rounds down, once for all of its lines

Status: accepted
Date: 2026-10-18

## Context

Nothing reserves a share (`table-self-pay/0007`), so guests paying at once
from the same view each pay the share they saw. A fraction rounded half up
asked three guests splitting a 579.00 CZK bill 193.01 CZK each, and paid at
once they paid 0.03 CZK more than the bill. Czech law lets a seller round
only the total of a cash payment (zákon 634/1992 Sb. § 3). The guest page
shows equal shares and a share of each line side by side
(`table-self-pay/0019`), so the two must ask the same amount for the same
share.

## Decision

A share never rounds up. Every share over lines rounds down once for all of
its lines: each line gets its exact amount rounded down, the share is the
exact sum of its lines rounded down, and the minor units still missing go
one each to the lines with the largest remainder, the earlier line first on
a tie. A line with nothing left takes no part, and a fraction of the whole
bill is that share over every line with something left, so 1/3 of
579.00 CZK is 193.00 CZK, and 1/3 of each line of a 5.00 + 8.00 CZK bill
asks 4.33 CZK, 1.67 CZK of the first line and 2.66 CZK of the second, as
1/3 of the bill does. A share that would leave less on a line than its
number of shares is all that is left on the line, so the last guest of a
line pays its rest, and the bill minimum (`table-self-pay/0011`) still adds
the last cents of a bill. The merchant device prices a selection with the
same function, so the page and the device agree.

## Alternatives considered

Rounding half up. Guests paying at once overpay by up to one minor unit per
line each.

Rounding half to even. It still rounds up about half the time.

Rounding every line on its own. A third of 579.00 CZK becomes 192.98 CZK, a
figure no guest expects, and two choices that mean the same share ask
different amounts.

## Consequences

Guests paying shares at once can leave a few minor units unpaid, fewer than
there are guests on each line or bill they split, instead of overpaying.
Any guest pays them as everything left, or staff takes them.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > calculateSelfPayShare > asks 4.33 for a third of each line of a 5.00 and 8.00 bill, as for a third of the bill`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > calculateSelfPayShare > asks 3.00 for a third of the bill as for a third of each open line once a line is paid`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > splitting random bills > asks the same for 1/N of every line as for 1/N of the bill`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > pays 1.67 and 2.66 of the lines for a third of each line of a 5.00 and 8.00 bill`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > calculateSelfPayLineShare > rounds a third of 98.00 down and leaves the rest to the last payer`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > calculateSelfPayShare > asks each of three guests for 193.00 of a 579.00 bill and settles it`
- `packages/core/src/modules/table-self-pay/table-self-pay-share-utils.test.ts > calculateSelfPayShare > leaves 0.02 of a 98.00 bill when three guests pay a third at once`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > settles a 579.00 bill that three guests split in thirds one after another`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > leaves 0.02 when three guests pay a third of 98.00 from the same view`
