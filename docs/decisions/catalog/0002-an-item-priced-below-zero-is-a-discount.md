# 0002 An item priced below zero is a discount, its sign set once and without a VAT rate

Status: accepted
Date: 2026-11-10

## Context

A business wants to take a fixed amount off a bill — a loyalty discount, a
voucher, a returned deposit — and to sell it the way it sells anything
else: from the catalog, by a tap or a scan, on any bill. The schema, the
bill line projection and the statistics took only prices of zero and above
(catalog/0001); the amounts below zero are now carried through, and a
discount is spread over the goods before VAT is counted (catalog/0003).

Three things a discount must not do. It must not carry a VAT rate: it lowers
what the guest pays for goods of whatever rates, so a rate on it would mean
nothing. It must not be zero: a discount of nothing is an item by mistake.
And it must not become an item, or an item a discount, later: a bill line
keeps the `catalogItemId` it was sold from, and the statistics
(`coalesce(catalogItemId, itemId)` in `sales-stats-queries.ts`) and a
payment's line diff (`bill-line-utils.ts`) would then merge the sales of the
item with the discounts it turned into.

Android's decimal keyboard (`inputMode="decimal"`, `decimal-pad`) has no
minus key, so a form cannot ask for the sign to be typed.

## Decision

- A catalog item priced below zero is a discount. There is no separate
  discount type: the sign of `unitAmount` makes one (`isDiscountPrice`), and
  a bill line's `kind` (`add`/`remove`) still says only the direction. The
  item a discount is sold as hashes its price, so a discount gets an `item`
  of its own.
- A discount has no VAT rate (`DiscountWithTaxRate`). An update that sets a
  rate on a discount is judged against its stored price and refused too.
- The sign is set only when an item is created. An update that moves a price
  across zero, in either direction, is refused
  (`CatalogItemPriceSignChange`): the core holds the rule, not only the
  form, so the CLI keeps it too. A discount cannot be updated to zero
  either, since zero is not below zero.
- Both rules live in `validateCatalogItemPricing` beside catalog/0001's,
  which the forms, the inline edits and the core actions call; on an update
  the core passes the stored price as `originalUnitAmount`.
- A discount is never zero. Zero has no sign, so this is the form's rule:
  with the Discount switch on, an amount of zero is refused at the price
  (`catalog.items.form.price.discountZero`). With it off, zero is a free
  item (catalog/0001).
- The forms take the amount without a sign. The create form of the catalog
  and the create-item dialog of a bill, in both apps, have a Discount switch
  that turns the amount below zero, hides the VAT rate picker and saves the
  item with `taxRateId = null`, with a hint that the discount is spread over
  the bill's goods. The edit form has no switch: a discount's price field
  shows and takes its amount without the sign, says the item is a discount,
  and offers no VAT rate.
- The CLI takes a negative `unitAmount` on `catalog-items create` and
  `update` (`IntegerFromStringSchema`) and creates a discount; it has no
  switch, the sign is the amount's. Its errors are the core's. Its
  `bills remove-item` takes the line's own sign too, and the core refuses a
  removal that is not part of the line as the bill holds it — another sign,
  or more than the line (`BillLineRemovalOutOfRange`): it would raise the
  bill, or leave goods below zero as a discount nobody added.
- A discount line shows its amount with a minus in the cart, on the bill
  detail and on the payment detail, and no VAT rate of its own.
- Adding, removing or moving a discount lowers a bill's total and needs
  `discard` (access/0012). A bill its discounts take below zero can only be
  discarded (payment/0015).

## Alternatives considered

A discount type of its own beside the price, which every projection, the
statistics and the sync would have to learn about, where a sign is already
carried by every sum. Letting an item's sign change, which merges sales and
discounts under one `catalogItemId`. A minus key or a typed sign in the
price field, which Android's decimal keyboard does not offer. A percentage
discount on the whole bill: a change of the bill, not an item, and a
different model; out of scope.

## Consequences

The risk of older app versions is accepted, with no guard by device
version. Evolu checks a synced row's table and column, not its value, so a
device on an app version from before discounts stores a discount line and
then:

- crashes on the payment detail and on the Qerko receipt, and Qerko then
  cancels the payment;
- writes "remove one" of a discount as `remove(1, 0)`;
- loses the discount when it splits the bill;
- charges the bill's total without the discount;
- does not spread the discount, so it counts it in the "no rate" VAT group
  and freezes no `discountShare` with a payment (catalog/0003).

The new `paymentLine.discountShare` column is ignored by such a device.
Since nothing guards against it either way, the steps of the change (a free
item, closing a bill a cart write pays off, the discount) are not split into
separate releases. A business should update every device before it creates
a discount.

## Enforced by

- `packages/core/src/modules/catalog-item/catalog-item-utils.test.ts > validateCatalogItemPricing > takes a discount without a VAT rate`
- `packages/core/src/modules/catalog-item/catalog-item-utils.test.ts > validateCatalogItemPricing > refuses a discount with a VAT rate`
- `packages/core/src/modules/catalog-item/catalog-item-utils.test.ts > validateCatalogItemPricing > refuses an update that moves the price across zero`
- `packages/core/src/modules/catalog-item/catalog-item-utils.test.ts > validateCatalogItemPricing > takes an update that keeps the sign`
- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > catalog item discounts > a discount with a VAT rate cannot be saved`
- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > catalog item discounts > an update cannot change the sign of a price`
- `packages/app-shared/src/catalog-item-form-schema.test.ts > parseCatalogItemForm > turns the amount of a discount below zero and drops its VAT rate`
- `packages/app-shared/src/catalog-item-form-schema.test.ts > parseCatalogItemForm > refuses a discount of nothing at the price`
- `packages/app-shared/src/catalog-item-form-schema.test.ts > parseCatalogItemForm > still refuses a signed amount for a discount`
- `packages/app-shared/src/catalog-item-form-schema.test.ts > updateCatalogItemErrorKeys > a discount given a VAT rate or an update across zero says which rule`
- `packages/app-shared/src/price-codec.test.ts > createPriceCodec for a discount > shows the amount without its sign`
- `packages/app-shared/src/price-codec.test.ts > createPriceCodec for a discount > keeps the sign of what is typed`
- `packages/app-shared/src/price-codec.test.ts > createPriceCodec for a discount > refuses a discount of nothing and a typed sign`
- `apps/cli/src/cli-catalog-items.test.ts > catalog-items create > a negative unit amount %s creates a discount`
- `apps/cli/src/cli-catalog-items.test.ts > catalog-items update > keeps the sign of a discount's amount, as the core does`
- `packages/app-shared/src/format-money.test.ts > formatMoney > writes a discount below zero with its sign`
- `apps/web-app/e2e/catalog-items.spec.ts > a discount created with the Discount switch has no VAT rate and takes its amount off a bill`
- `packages/core/src/modules/bill/bill-actions.test.ts > bill actions > refuses a removal of another sign, or of more than the line holds, writing nothing`
