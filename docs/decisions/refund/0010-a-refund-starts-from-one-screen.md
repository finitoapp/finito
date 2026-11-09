# 0010 Every refund starts from one screen: what, how and how much

Status: accepted
Date: 2026-11-09

## Context

The payment detail offered up to five ways into a refund, each with a dialog
of its own: the goods by amount or items, the tip, the whole payment to the
card through SwitchioPay (Finito only), the whole Qerko payment, and the
state of a card attempt. The method was chosen in two of them, staff had to
know that returning everything outside the card took two confirmations (goods,
then tip, refund/0004), and only the dialog said how much was left. The
collision of a cancelled payment that was paid anyway had a "Refund" that
only said "coming soon" in Finito. Plan: `docs/plans/refund-flow.md`.

## Decision

The payment detail has one "Refund money" action. It opens a screen of its
own (`/activity/:paymentId/refund` in both apps) that asks what, how and how
much, says in one sentence what confirming does (`describeRefundOutcome`) and
names the exact amount on its confirm button. Payky and Finito draw the same
screen from the same rules (`deriveRefundOptions`,
`packages/app-shared/src/refund-form.ts`); they differ only in the methods
the app can make.

- **What.** Only what the payment still allows: **the whole payment**, every
  goods amount left and the tip if it was not refunded; **part**, goods only
  by amount or, from a bill's only payment, by items (refund/0002, 0005),
  never the tip (refund/0011); **only the tip**, the whole tip once
  (refund/0011). The screen starts on the whole payment.
- **How.** Every method suits every choice, where the payment and the device
  can make it: back to the card through SwitchioPay (Finito, refund/0007,
  with a reversal when it can be one, refund/0008) or the Qerko terminal that
  took it (qerko/0004, 0006), cash from the register, outside the app. A Qerko
  payment goes back through Qerko only whole and only while nothing of it was
  refunded (qerko/0010). The screen starts on the method the payment came in
  by, else outside the app, and keeps the chosen method when the choice
  changes while the new choice allows it.
- **How much.** Only for part: the prefilled amount (refund/0005, 0012) or the
  items.
- **The whole payment is one step for every method**, and its data stays two
  records, the goods' refund and the tip's under its one id per payment
  (refund/0011), written in one batch (`refundWholePayment` for cash and
  outside the app). Cash records exactly the goods left and the tip; the
  cash handed out is rounded to whole crowns once for both (refund/0012).
- **A refund to the card shows its progress on the screen** until the
  terminal answers; an unknown answer returns to the payment detail, where
  the attempt stays with its own actions.
- **The action is hidden when nothing is refundable**, and while a card
  attempt of the payment is still running.
- **The screen's route requires `refund`** (access/0002, 0003), so the PIN is
  asked when the screen opens, not when confirming. The actions on it ask
  nothing more.
- The collision's "Refund" opens the same screen.

## Alternatives considered

A "including the tip" switch on part, which would let an amount carry the
tip again (refund/0004 rejected that). Keeping the dialogs and adding a whole
payment button to each method, which keeps five entries and the method chosen
twice. A single refund row for goods and tip together, which would break
everything that tells the tip apart (EET, statistics, the refunded state).

## Consequences

Returning everything takes one confirmation, whatever the method. A refund of
the whole payment to the Qerko terminal (`startQerkoTerminalRefund({ whole })`)
asks the terminal once for goods and tip together and keeps the tip on the
attempt (`qerkoTerminalRefundAttempt.tipAmount`) to write the tip's refund
beside the goods once it approves. Any device of the account may settle the
attempt (qerko/0005), and an older version settling it writes the goods
alone. So the Qerko sync job writes such a missing tip refund whenever one
shows up (`repairQerkoTerminalTipRefunds`), under the tip's one id and dated
as the goods were, so a repair running twice or beside a newer settlement
writes it once. Until every device runs a version with the job, a whole
refund settled by an older one shows the tip refund only once a newer device
runs.

## Enforced by

- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > $method: whole $whole, part $part, tip $tip`
- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > offers a card method only where this device can refund that card`
- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > offers the whole payment with its tip, the goods alone, and the tip alone`
- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > offers only the tip once the goods are all back`
- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > offers nothing when nothing is left`
- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > offers items only beside an amount, from a bill's only payment (refund/0002)`
- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > starts a payment that came by $kinds on $method`
- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > keeps the method a new choice allows, else takes its first`
- `packages/app-shared/src/refund-form.test.ts > describeRefundOutcome > a whole card payment taken back needs no card (refund/0008)`
- `packages/app-shared/src/refund-form.test.ts > describeRefundOutcome > any other card refund goes back to the card that paid`
- `packages/app-shared/src/refund-form.test.ts > describeRefundOutcome > cash names what to hand over, outside is only recorded`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > records the goods and the tip as two refunds in one batch`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > a second run records nothing twice`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > writes only the goods of a payment without a tip`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > writes only the tip once the goods are all back`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > writes only the goods left once the tip is back`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > refuses a payment that is not paid`
- `packages/core/src/modules/refund/refund-qerko-actions.test.ts > refund of the whole payment to the card through Qerko > asks the terminal once for the goods and the tip and records them as two refunds`
- `packages/core/src/modules/refund/refund-qerko-actions.test.ts > refund of the whole payment to the card through Qerko > a payment without a tip refunds only its goods`
- `packages/core/src/modules/refund/refund-qerko-actions.test.ts > refund of the whole payment to the card through Qerko > with only the tip left, refunds the tip as the tip`
- `packages/core/src/modules/refund/refund-qerko-actions.test.ts > refund of the whole payment to the card through Qerko > the tip an older version left out when it settled the attempt is written once`
- `packages/core/src/modules/refund/refund-qerko-actions.test.ts > refund of the whole payment to the card through Qerko > a dismissed attempt was never approved and needs no repair`
- `packages/core/src/background-jobs/jobs/qerko-terminal-sync-job.test.ts > qerko terminal sync job > writes the tip an older version left out when it settled a whole refund`
- `apps/web-app/e2e/refund.spec.ts > refund a whole payment in cash: the goods and the tip come back as two refunds`
- `apps/web-app/e2e/access.spec.ts > a refund asks for the PIN when its screen opens, naming the permission it needs`
- `apps/web-app/e2e/qerko-terminal.spec.ts > refund a card payment back to the card through the terminal`
