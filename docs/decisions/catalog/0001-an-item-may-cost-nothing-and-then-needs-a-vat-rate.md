# 0001 An item may cost nothing, and a VAT payer's free item needs a VAT rate

Status: accepted
Date: 2026-11-10

## Context

A catalog item's price could only be positive. The schema already took zero
(`catalogItem.unitAmount` is a non-negative integer), but the catalog form
read the price through the parser of an amount to charge, which refuses
zero. Businesses give things away and want them on the bill all the same:
tap water, a bread basket, a modifier that costs nothing.

A free item still appears on the receipt and in the VAT recap, where every
line belongs to a VAT rate. A VAT payer's item may otherwise be saved
without a rate ("not assigned yet", the comment on `catalogItem.taxRateId`),
since a positive line without one is visible as such and gets fixed; a free
line without one has no amount that would ever draw attention to it.

## Decision

- A catalog item's price may be zero: the form, the inline price edit and
  the CLI take it. The price parser of the form is its own
  (`decimalPriceToMinorUnits`); the keypad, a tip, cash received and a
  withdrawal keep refusing zero.
- A VAT payer's item priced at zero must have a VAT rate
  (`ZeroPriceWithoutTaxRate`). An account that is not a VAT payer enters no
  rates and saves a free item without one. A VAT payer's positive item may
  still be saved without a rate.
- The rule is one function, `validateCatalogItemPricing`, which the catalog
  form, the inline edits and the core actions (`createCatalogItem`,
  `updateCatalogItem`) all call, so the CLI keeps it too. The core reads
  whether the account is a VAT payer from its legal entity.
- The rule is judged when an item is saved. An account that becomes a VAT
  payer later keeps its free items without a rate; the next edit of their
  price or rate is refused until it has one, while an edit of anything else
  goes through.

## Alternatives considered

Requiring a rate on every item of a VAT payer, which would refuse items that
are saved today and fix nothing about a free one. Rewriting free items
without a rate when the account becomes a VAT payer, which would pick a rate
for the business.

## Consequences

A free line is not offered in a refund by items, since a refund of it alone
would come to nothing. A bill of free items alone is not charged but
finished without a payment (payment/0012, payment/0013).

## Enforced by

- `packages/core/src/modules/shared/money.test.ts > decimalPriceToMinorUnits > takes a zero price, which an amount to charge refuses`
- `packages/app-shared/src/catalog-item-form-schema.test.ts > parseCatalogItemForm > takes a zero price`
- `packages/app-shared/src/price-codec.test.ts > createPriceCodec > decodes a zero price`
- `packages/core/src/modules/catalog-item/catalog-item-utils.test.ts > validateCatalogItemPricing > refuses a VAT payer's zero price without a VAT rate`
- `packages/core/src/modules/catalog-item/catalog-item-utils.test.ts > validateCatalogItemPricing > takes a zero price without a VAT rate from an account that is not a VAT payer`
- `packages/core/src/modules/catalog-item/catalog-item-utils.test.ts > validateCatalogItemPricing > still takes a VAT payer's positive price without a VAT rate`
- `packages/app-shared/src/catalog-item-form-schema.test.ts > parseCatalogItemForm > refuses a VAT payer's zero price without a VAT rate at the price`
- `packages/app-shared/src/catalog-item-form-schema.test.ts > parseCatalogItemForm > takes a zero price without a VAT rate from an account that is not a VAT payer`
- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > catalog item pricing > a VAT payer cannot save a zero-priced item without a VAT rate`
- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > catalog item pricing > an account that is not a VAT payer saves a zero-priced item without a VAT rate`
- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > catalog item pricing > an update that touches neither the price nor the rate is not judged`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableLines > does not offer a free line`
- `packages/app-shared/src/catalog-item-form-schema.test.ts > updateCatalogItemErrorKeys > an inline edit of the price or the VAT rate the core refuses shows the create form's own message`
