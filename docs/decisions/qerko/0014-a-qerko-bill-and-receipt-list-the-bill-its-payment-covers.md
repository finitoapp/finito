# 0014 A Qerko bill and receipt list the bill its payment covers

Status: accepted
Date: 2026-11-11

## Context

`qerko/0009` made the bill Qerko gets for a payment one line, "Platba #N",
which suits a payment typed on the keypad: it has an amount and nothing
else. A payment of a bill has more. It freezes the bill's lines into
`paymentLine` when it is made (`snapshotBillLinesForPayment`), each goods
line with its share of the discount (`catalog/0003`), and Charge asks for the
bill's whole total. The customer still saw only "Platba #7" in Qerko and on
the receipt, and a payment of part of a bill got its VAT as one 0 % line,
goods the owner taxes included. A VAT payer's keypad payment got one 0 %
line too, although the owner sells keypad amounts at a rate.

Qerko stores the receipt `paymentProcessed` answers as it stands and, unless
the receipt says it is delivered elsewhere, draws it as the customer's PDF:
each item as `<quantity>× <name> <price>`, the quantity without decimals, and
`taxInfo` as a table of rate, base, tax and total. It checks neither sum
against the amount. An item's `price`, on the bill as on the receipt, is the
line's total, not its unit price: Qerko does not multiply it by the
quantity. Its own receipts do the same, and send a discount as an item below
zero.

## Decision

- A payment's goods are its amount less its tip. Qerko is offered the goods
  only, and the customer tips in Qerko (`qerko/0015`).
- A payment covers its bill when its goods equal the sum of `totalAmount`
  over its frozen lines: goods, a discount line below zero and the cart's tip
  lines alike, which is the bill's total when the payment was made. A frozen
  line whose item snapshot is missing is left out of the sum, so its payment
  falls back to one line. That makes four kinds of payment:

  | Payment | Bill and receipt items | `taxInfo` of a VAT payer |
  | --- | --- | --- |
  | from the keypad | one line, "Platba #N", the goods | one row at the keypad rate, none without it |
  | covering its bill | the bill's lines | the bill's recap |
  | covering part of its bill (a CLI amount, a bill partly paid) | one line, "Platba #N", the goods | the bill's recap prorated to the goods |
  | above its bill (CLI only) | one line, "Platba #N", the goods | the bill's recap, the rest left out |

  The receipt lists no tip, not even the one the customer chose in Qerko
  (`qerko/0015`).
- Each frozen line is one item, named from its item snapshot; on the bill its
  `id` is the `paymentLine`'s and `minQuantity` stays `"0"`.
  - Every item is priced at its line's total, on the bill and on the
    receipt alike. A whole quantity goes as it is; any other goes as
    quantity `1`, since Qerko draws a quantity without decimals, with the
    quantity in the name, a decimal comma and no trailing zeros:
    `Sýr (0,35)`.
  - A discount line is an item below zero under its own name, a tip line of
    the cart an ordinary item, an item at zero goes as it is.
  - Goods come in the order their item first appeared in the bill's ledger,
    then discounts, then tips. The bill and the receipt list the same items
    in the same order. Like "Platba", the names Payky adds are Czech
    whatever the app's language.
- `taxInfo` covers the payment's goods and nothing else: neither the tip set
  on Payky's tip screen nor the one the customer chose in Qerko, which are no
  goods and carry no VAT.
  - For a payment of a bill it comes from the recap of the frozen lines
    (`calculateTaxRecap`, net of their discount shares), the lines without a
    rate in a group of their own.
  - For a keypad payment it is one row at the rate the business set for
    keypad amounts (`appSettings.keypadTaxRateId`), split by
    `splitInclusiveAmount`. The rate is read when Qerko asks for the
    receipt, which Qerko keeps, not frozen with the payment.
  - The recap is complete when its groups add up to what it stands for: the
    frozen lines' total, or the keypad payment's goods. A line whose rate has
    not synced to the device yet, a recap that comes out empty (a discount an
    older version froze without shares, a payment of a bill that froze no
    lines), no keypad rate set, or one the device does not hold — deleted, or
    not synced yet — makes it incomplete, and a VAT payer's `taxInfo` is then
    empty. Qerko takes it as optional and draws no VAT table.
  - For a payment of part of its bill, `prorateTaxRecap`
    (`bill-line-tax-utils.ts`) gives each group
    `grossAmount × goods / Σ grossAmount`, rounded down to minor units, and
    the units left over to the groups with the largest remainder, ties to the
    one listed first, so the groups add up to the payment's goods exactly.
    Each group is then split into base and tax by its own rate
    (`splitInclusiveAmount`).
  - What a payment above its bill pays over it is no goods of the bill and
    is left out.
  - Groups of the same percentage are one row: the group without a rate and
    a 0 % rate are one row, `rate: "0"`, listed last, and there is a 0 % row
    only when there are such goods; the other rates come in their
    `sortOrder`.
  - A business that is not a VAT payer has one 0 % row for the goods, and the
    same items as a payer.
- The bill is otherwise unchanged: its id is the payment's, its name `#N`,
  `allowPartialPayment` false, `denyDiscounts` and `denyMenus` true. So are
  the errors `paymentStart` answers. It checks the sum of the items' prices
  against the goods, each price a line's total and not multiplied by its
  quantity; several items and a discount below zero add up to it.

## Alternatives considered

- One line for every payment (`qerko/0009`): it hides from the customer what
  they pay for.
- The bill's lines for a payment of part of it: Qerko would let the customer
  pay something other than the payment, which is why `qerko/0009` sent one
  line, and that still holds.
- Goods at their prices after the discount instead of a discount item: the
  prices would no longer match the menu.
- One 0 % row for a payment of part of a bill, or for a VAT payer's keypad
  payment: it says that taxed goods carry no VAT.
- A tip at 0 % in `taxInfo`: a tip is not a sale of goods, and the VAT table
  would no longer add up to what the goods cost.
- Freezing the keypad rate with the payment: the receipt is made once and
  Qerko keeps it, so nothing would read the frozen rate until the payment
  detail shows a keypad payment's VAT.
- Refusing `paymentProcessed` when the recap is incomplete: Qerko cancels a
  payment without a receipt, one the customer has just authorized.

## Consequences

The bill and the receipt are built from the same frozen lines, so the
receipt says what the customer saw, and neither changes later, since the
lines do not. `searchBills`, `getBill` and `paymentProcessed` read the frozen
lines, their item snapshots and the bill's ledger on top of the payment, and
a keypad payment's receipt reads the keypad rate. Prorated VAT is split per
rate, not per line, so it can differ by one minor unit from splitting each
line of the part paid. Qerko checks no sum, so the tests hold that the
receipt's items add up to the goods, that its
VAT rows add up to the goods when there are any, and that no row is below
zero. A VAT payer who never sets a keypad rate gets keypad receipts without
a VAT table. The rate is set on the tax rates screen.

## Enforced by

- `packages/core/src/modules/bill-line/bill-line-tax-utils.test.ts > prorateTaxRecap > adds up to the goods exactly`
- `packages/core/src/modules/bill-line/bill-line-tax-utils.test.ts > prorateTaxRecap > gives the rounding to the largest remainder`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoBill > a keypad payment is one line, paid at once`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoBill > lists the lines of a bill its payment covers`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoBill > a payment covering part of its bill stays one line`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoBill > a discount goes as a line below zero`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoBill > a line whose quantity is not whole goes as one at its total`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoBill > its lines add up to the payment's goods`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > checkQerkoPaymentStart > compares the items with the payment's goods, the customer's tip in none of them`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > uses the bill's VAT lines when they cover the payment`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > prorates the bill's VAT to a payment covering part of it`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > taxes a VAT payer's keypad payment at the rate set for keypad amounts`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > a VAT payer's keypad payment carries no VAT lines when %s`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > one 0 % line holds the lines without a rate or at 0 %, not the payment's tip`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > carries no VAT lines when the recap misses a line`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > a business that is not a VAT payer has one 0 % line`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > leaves out of the VAT lines what a payment above its bill pays over it`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > its items and its VAT lines add up to the goods`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > orderQerkoLines > goods in the bill's order, then discounts, then tips`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > resolveQerkoBill > offers the payment as one line, paid at once, without discount`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > resolveQerkoBill > offers a bill its payment covers line by line`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > resolveQerkoBill > a payment no longer waiting is a closed bill`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > startQerkoPayment > refuses %j as %s`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > startQerkoPayment > locks the bill while another Qerko payment of it is in progress`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > startQerkoPayment > accepts the lines it offered`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > processQerkoPayment > answers a discounted bill's VAT from the net lines its payment froze, no rate below zero`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > processQerkoPayment > prorates a partly paid bill's VAT`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > processQerkoPayment > taxes a VAT payer's keypad payment at the keypad rate set when the receipt is made`
