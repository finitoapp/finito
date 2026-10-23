# 0019 A guest sees what each choice costs, and is done once their payment is confirmed

Status: accepted
Date: 2026-10-22

## Context

Staff splits bills with a stepper and offers tips with their amounts. A
guest who must find their share through tabs, chips and lists of fractions
sees its amount only on the pay button. A guest whose half was confirmed
and who then sees the rest of the table picked, with a button to pay it,
reads it as money they still owe.

## Decision

The guest picks one of three choices, each showing its amount before it is
picked: everything left, equal shares and by items. Another amount is a
link under them. Everything left is picked when the page opens.

Equal shares counts people from 2 to 20 and says each pays that fraction of
the whole bill. By items gives each line a stepper of units up to the units
still unpaid on it, and its top pays everything left on the line. A picked
line can be marked as shared, which makes it one share of the whole line
among 2 to 10 people.

The tip offers none, 5, 10, 15 and 20 % and a custom tip, typed as
`table-self-pay/0018` says, each with the tip it adds. While the guest
chooses, the share, the tip and the pay button stay at the bottom of the
screen.

A guest whose own payment on the shown bill is confirmed is done. The page
leads with that confirmation, with focus on it, and shows no choice, no tip
and no pay button. While something is left on the bill, "Pay something
else" opens the choices with nothing picked. Once nothing is left, it is
not offered.

Every choice is a split the selection carries
(`table-self-pay/0020`), so the page and the merchant device price it alike.

## Alternatives considered

Equal shares of what is left instead of the whole bill. What a share
already paid means would change as other guests pay.

Keeping fractions of a line other than sharing among people, such as half
of five beers. Sharing the whole line between two asks for the same money
in one step.

The tip as a step of its own after the share, as staff has it. It adds a
screen to the shortest path, everything left with no tip.

Keeping everything left picked after a confirmed payment, with the pay
button under the confirmation. It is the push to pay the rest of the table
that the review found.

No way to pay more after a confirmed payment. A guest who also covers a
friend would have to ask the staff.

## Consequences

Paying for the whole table is one tap, and its amount is on the choice and
on the pay button. A fraction of a line that is neither units nor a share
among people cannot be picked on the page, though the merchant device still
prices one. A guest who is done and pays again takes one
more tap and picks the share themselves.

## Enforced by

- `apps/web-app/src/features/table-self-pay-guest/guest-share-choice.test.ts > the units of a partly paid line stop at what is left and ask for all of it`
- `apps/web-app/src/features/table-self-pay-guest/guest-share-choice.test.ts > a pizza shared by five people asks for a fifth of it`
- `apps/web-app/src/features/table-self-pay-guest/guest-share-choice.test.ts > a percent tip is the share times the percent, rounded to the minor unit`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest sees what each choice and tip costs before paying`
- `apps/web-app/e2e/table-self-pay.spec.ts > guests pay a fifth of a line at the table while nobody reserves anything`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest paying at the table > a guest whose payment is confirmed is done and pays nothing more unless they ask`
