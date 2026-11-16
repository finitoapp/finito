# 0013 Onboarding offers a starter pack to a business selling from items, each product priced by the merchant

Status: accepted
Date: 2026-11-16

## Context

A new account that sells bills built from items (onboarding/0012) opened on
an empty catalog, and its first sale waited until the merchant had typed
every item under Settings. Most cafés, bistros and bars start from the same
few dozen products, and the product library (product-library/0001) lists
them as starter packs, with names, categories and VAT but no prices: a
price is the merchant's, and an item sold at a price nobody typed is money
taken that nobody asked for.

## Decision

Finito first; Payky's web app follows from the same app-shared code.

- **The last step offers starter packs to a new account selling from
  items.** Under the "Bills" choice of "How do you sell?", "Start with a
  menu" lists the library's packs (Café, Bistro, Bar, named in the device's
  language) beside "Start empty". It is not offered on the keypad choice,
  to an account being opened (restore, transfer, from Payky), nor to a
  restored phrase set up afresh, whose catalog may still be on a relay; nor
  while the library is not loaded (catalog/0005), in which case the step is
  as it was.
- **"Start empty" is the initial choice.** The merchant may finish without
  touching the section, and the catalog then starts empty.
- **A picked pack lists its products, all checked, each with its picture
  and an empty price field** in the onboarding currency. Picking another
  pack checks all of its products again; prices typed stay with their
  product while the step is open, so going back and forth loses no typing.
- **Every checked product needs a typed price before Finish is
  available.** A price is in CZK, 0 included (catalog/0001), never negative
  or unreadable; unchecking a product is the way to skip it. The section
  says what is missing.
- **A picked pack the library stops offering blocks Finish.** When a
  fresher copy of the library replaces the one the step opened with and no
  longer has the picked pack, the section asks to pick again instead of
  finishing with an empty catalog the merchant did not choose.
- **Only the checked products are created, at the prices typed,** named
  and categorized in the device's language, each with its
  `libraryProductId` (catalog/0006) and the account's active tax rate of
  the library's VAT for the onboarding country, CZ (onboarding/0001), or
  none when the account has no such rate. Products of one library category
  share one category, made where none of that name exists.
- **They are created with the account, in the batch of its settings
  row.** `finishOnboarding` judges the whole pack first, once the tax rates
  are seeded and before anything of it is written, then writes its new
  categories, every item and the row that marks the account onboarded in one
  batch, so the pack and the onboarded account land together or not at all.
  One item its pricing rules refuse (a product given away for 0 without a
  VAT rate, catalog/0001) writes no category and no item and leaves the
  account not onboarded, so the wizard can finish again; the merchant is
  told to price or uncheck it. A finish cut short after the settings row is
  written is a finished onboarding; one cut short before it left no pack
  behind, so finishing again creates each category and item once.

## Alternatives considered

- Preselecting a pack: the merchant could finish without noticing, and
  the catalog would hold products they do not sell.
- Prices from the library, or creating the items without a price for the
  merchant to fill in later: either sells at a price nobody chose.
- Creating the items after onboarding finished: a refused item would leave
  an onboarded account with half a pack and no wizard to finish it in.

## Consequences

- The onboarding form holds `starterPack` (`packId`, the unchecked
  products, the prices typed); `finishOnboarding` takes the resulting
  `starterItems`, none when left out.
- The writes before the pack (the legal entity, the seeded tax rates, the
  payment accounts) are their own batches and may land without it; each is
  skipped once its row exists or is a singleton upsert, so a second finish
  repeats none of them.
- A pack offers only the products the library still suggests; a pack left
  with none is not offered.

## Enforced by

- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > starts with no starter pack`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > cannot finish when the picked pack is no longer offered`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > offers starter packs only to a new account selling from items once the library has loaded`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > lists a pack's suggestable products in its order, named in the device language and all checked`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > cannot finish until every checked product has a typed price`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > takes 0 as a typed price but not a negative or unreadable one`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > submits only the checked products with the prices typed`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > names and categorizes the items in the device language, with the library's VAT for the account's country`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > submits no starter items when selling on the keypad`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > submits no starter items when starting empty, and keeps the prices typed`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > submits no starter items without a library or for an account being opened`
- `packages/app-shared/src/onboarding-starter-pack.test.ts > starter packs on the last step > checks every product of a newly picked pack again`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > starterPackProducts > lists a pack's products in order, without the retired ones`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding starter items > creates the starter items with their categories and VAT rates`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding starter items > keeps the starter items' prices exactly as the merchant typed them`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding starter items > creates no catalog items without starter items`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding starter items > writes the starter categories and items in the batch that marks the account onboarded`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding starter items > a refused starter pack leaves the account not onboarded and writes no categories or items`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding starter items > finishing again after a refused pack creates each category and item once`
- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > createCatalogItemsAtEnd > appends the items in the order given after the last one`
- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > createCatalogItemsAtEnd > writes none of the items when one breaks the pricing rules`
