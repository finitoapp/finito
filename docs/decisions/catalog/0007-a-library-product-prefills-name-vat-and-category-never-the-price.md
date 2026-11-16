# 0007 A library product prefills an item's name, VAT and category, never its price, and offers its related products

Status: accepted
Date: 2026-11-16

## Context

Picking a suggestion (catalog/0005) can fill more of the form than the name.
The product library knows each product's category and its VAT in each
country it covers, in hundredths of a percent; the account has its own tax
rates (seeded for its country, archived or added by the merchant) and its
own categories, which may be spelt otherwise. Prices are the merchant's
alone: they differ from café to café, and an item sold at a price nobody
typed is money the merchant did not ask for. A merchant who adds an
espresso most likely sells a cappuccino too, and the library lists each
product's related products for that.

## Decision

- **Picking a library product fills the name, the library product, the VAT
  rate and the category** of the create form (`libraryProductPrefill`), and
  nothing else:
  - the name in the device's language, and the product's id as the item's
    `libraryProductId` (catalog/0006);
  - the VAT rate: the account's active tax rate whose percentage equals the
    library's for the account's country (`libraryVatRateFor`). With no
    such rate, no country the library covers, or no value for it, the form
    keeps its own default; a non-VAT-payer account has no rates and gets
    none;
  - the category: the merchant's category that spells the library
    category's name, case, surrounding spaces and then diacritics aside
    ("Kava" for the library's "Káva", an exact spelling preferred), else
    that name as a new category, made when the item is saved
    (catalog/0004).
- **The price is never prefilled.** The library carries no prices, and the
  form's price field stays as the merchant left it.
- **A saved library item offers its related products.** Back on the items
  list after Settings' create form saved an item from the library, a card
  "Add also" offers up to five of its related products, in the library's
  order, leaving out those the catalog already has (by `libraryProductId`)
  and those the library retired or does not know. Each chip opens the
  create form filled from that product as above, with an empty price; when
  the library files both products in one category, under the category the
  merchant gave the item just created. The card goes when dismissed, when
  nothing is left to offer, or once the list is left.

## Alternatives considered

- Prices in the library, or a suggested price: prices are local and
  change, and a prefilled price is one the merchant may never look at.
- Mapping the library's VAT to the account's rate by name or by kind
  ("reduced"): names are the merchant's to edit and kinds differ by
  country; the percentage is what a receipt states.
- Adding the related products at once, in one tap: each would need a price
  the merchant did not type.

## Consequences

- Only Settings' create form leads to related products: the bill's
  create-item dialog returns to the bill, which has no place for the card.
- A library VAT value the account has archived or never had leaves the
  form's default, which the merchant then sees and may change; the library's
  values are confirmed by an accountant before a release
  (`docs/product-library.md`).
- A merchant who renamed their category keeps getting the library's name
  as a new category unless the names match; the related chips carry the
  merchant's own category across where the library files both together.

## Enforced by

- `packages/app-shared/src/library-product-prefill.test.ts > a picked library product fills the create form > fills the name in the device's language and the library product's id`
- `packages/app-shared/src/library-product-prefill.test.ts > a picked library product fills the create form > picks the account's active VAT rate the library gives for its country`
- `packages/app-shared/src/library-product-prefill.test.ts > a picked library product fills the create form > keeps the form's VAT rate when the account has no rate of that percentage`
- `packages/app-shared/src/library-product-prefill.test.ts > a picked library product fills the create form > chooses the merchant's category of the library category's name`
- `packages/app-shared/src/library-product-prefill.test.ts > a picked library product fills the create form > adds the library category's name when no category spells it`
- `packages/app-shared/src/library-product-prefill.test.ts > a picked library product fills the create form > leaves the category alone for a category the library does not name`
- `packages/app-shared/src/library-product-prefill.test.ts > libraryCategoryChoice > matches a category spelt without the library's diacritics`
- `packages/app-shared/src/library-product-prefill.test.ts > libraryCategoryChoice > prefers the category spelt exactly over one without diacritics`
- `packages/app-shared/src/library-product-prefill.test.ts > a related product's chip > files it under the item just created's category when the library puts both in one`
- `packages/app-shared/src/library-product-prefill.test.ts > a related product's chip > lets the library decide for a product of another library category or an uncategorized item`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > libraryVatRateFor > picks the account's active rate of the library's percentage for its country`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > libraryVatRateFor > picks nothing when the account has no rate of that percentage`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > libraryVatRateFor > picks nothing for an account without rates or outside the library's countries`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > libraryVatRateFor > picks nothing when the product has no rate for the country`
- `packages/core/src/modules/tax-rate/tax-rate-utils.test.ts > findActiveTaxRateByPercentage > finds the active rate of exactly that percentage`
- `packages/core/src/modules/tax-rate/tax-rate-utils.test.ts > findActiveTaxRateByPercentage > skips an archived rate of that percentage`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > relatedSuggestions > offers the related products in their listed order`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > relatedSuggestions > leaves out retired and unknown products`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > relatedSuggestions > leaves out products the catalog already has`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > relatedSuggestions > offers nothing once the catalog has them all`
