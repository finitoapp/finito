# 0016 Each Qerko flow has its own switch, on until turned off

Status: accepted
Date: 2026-11-18

## Context

Qerko payments (`qerko/0007`) reach a bill two ways. In the direct flow the
payment screen shows a QR code for one payment and Qerko finds it with
`searchBills` (Qerko's "direct bills" extension). In the table flow a guest
scans Qerko's own QR code on a table, and Qerko asks the POS for the
restaurant's tables (`getTableList`) and a table's open bills
(`getTableContents`, `qerko/0017`). A restaurant may want one of them and
not the other: no QR codes on the tables, or no QR code at the till.

Accounts paired before the table flow existed serve direct payments, and
nothing should change for them unasked.

## Decision

- `accountQerkoPayment` has two switches, `directPaymentEnabled` ("Direct
  payment", cs "Přímá platba") and `tablePaymentEnabled` ("Table payment",
  cs "Platba od stolu"). Both are nullable and `null` reads as on
  (`deriveQerkoPaymentFlows`), so an account saved before them keeps direct
  payments and gains table payments. Each is written on its own
  (`setQerkoPaymentFlows`), and both move with the account when its currency
  changes.
- A flow that is off answers Qerko as if Payky had nothing for it, with what
  Qerko's protocol answers for that: an empty list where Qerko asks for one
  (`searchBills` while direct is off, `getTableList` and `getTableContents`
  while tables are off) and `BILL_NOT_FOUND` where it names a bill
  (`getBill`, `paymentStart`).
- Direct payments off, the payment screen shows no Qerko tab and a payment is
  not created for Qerko alone (`derivePaymentMethodsOffered`).
- What follows a start — `paymentProcessed`, `paymentClosed`, `get-payment`
  and a refund — is answered whatever the switches say: the customer's money
  is already moving.
- Both switches may be off. The device still holds the connection, for
  payments already started; nothing new can start.

## Alternatives considered

- One switch per flow stored as `true`/`false` with a migration writing them:
  a device on an older version would write rows without them, and `null` as
  on needs no migration.
- An error such as `NO_SUCH_METHOD` for a flow that is off: Qerko reads it as
  a broken integration, where an empty table or an unknown bill is what a
  restaurant without that flow looks like.
- Refusing to turn the second switch off, as the home screen keeps a mode
  (`settings/0001`): the method's own switch already turns Qerko off, and a
  restaurant may pause both while keeping the pairing.

## Consequences

Turning direct payments off hides the Qerko tab of payments already waiting
on it, and their QR codes no longer find them. Turning tables off makes the
tables' QR codes show an empty table.

## Enforced by

- `packages/core/src/modules/account/account-utils.test.ts > deriveQerkoPaymentFlows > a switch never written reads as on, and so does no account`
- `packages/core/src/modules/account/account-utils.test.ts > deriveQerkoPaymentFlows > each switch is off only when stored off`
- `packages/core/src/modules/account/account-utils.test.ts > derivePaymentMethodsOffered > Qerko payments with the direct flow stored as %s offer %j`
- `packages/core/src/modules/account/account-actions.test.ts > Qerko payment flows > an account saved before the switches existed serves both flows, and each switch writes only itself`
- `packages/core/src/modules/account/account-actions.test.ts > Qerko payment flows > the flows move with the account to another currency`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getTableList > lists no tables while table payments are off`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getTableContents > lists no bills while table payments are off`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getBill > answers a table's bill with BILL_NOT_FOUND while table payments are off`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > paymentStart of a table's bill > refuses a table's bill as BILL_NOT_FOUND while table payments are off`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > settling a table's payment > paymentProcessed and paymentClosed are answered after table payments were turned off`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > direct payments off > searchBills answers no bill and getBill BILL_NOT_FOUND for a payment's QR`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > direct payments off > leaves table payments on`
- `apps/web-app/e2e/qerko-payment.spec.ts > pair Qerko payments: the right code leads on to the location, finishing turns the method on, and its flows switch on their own`
