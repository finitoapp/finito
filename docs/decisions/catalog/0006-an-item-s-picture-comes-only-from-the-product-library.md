# 0006 An item's picture comes only from the product library, by its libraryProductId

Status: accepted
Date: 2026-11-16

## Context

No catalog item had a picture, so the bill's item grid and the catalog list
were walls of names. A picture of its own per item would need storage the
app does not have: Evolu syncs rows, not blobs, and a photo in a column
would travel to every device on every change. The product library
(product-library/0001) publishes one picture per product, drawn in one
style, at fixed sizes, content-addressed and cacheable for good.

## Decision

- **An item's picture is its library product's, and only that.** A catalog
  item remembers the library product it came from in `libraryProductId`,
  set when the merchant picks a suggestion (catalog/0005), a related
  product (catalog/0007) or a starter pack product (onboarding/0013). Its
  picture is resolved through the loaded library each time it is shown
  (`libraryImageUrl`, the smallest published size at least as large as the
  slot on this screen), so a picture the library draws again reaches every
  item already pointing at the product. An id the library retired still
  resolves; one it does not know, a product with no approved picture, or
  no loaded library, shows no picture.
- **The picture is not part of what was sold.** `libraryProductId` stays on
  the catalog item and is never copied into the `item` snapshot bill lines
  point at.
- **A merchant's own photo is out of scope.** There is no upload; an item
  that did not come from the library has no picture and renders as before.
- **The merchant's name wins, the picture stays.** Renaming a saved item
  keeps its `libraryProductId`; the library's name is a suggestion, not a
  link to keep in sync.
- **A create form keeps the link only while the name refers to the
  product.** Before the item is saved, the product picked stays linked
  while the typed name, case and diacritics aside, contains the product's
  name in any language or one of its synonyms ("Espresso velké",
  "Dvojité espresso"); typed into something else ("Pivo" after picking
  Espresso) or emptied, the form drops it (`nameKeepsLibraryProduct`), so
  the item never carries another product's picture or related products.
- **The link is always visible, and "Unlink from library" removes it.** An
  item form names the linked library product ("From the library:
  Espresso"), with its picture when it has one, so a link without a
  picture is not hidden. "Unlink from library" sets `libraryProductId` to
  `null`, in the edit form at once and in a create form before saving; the
  item then has no picture and no library product for good, related
  products included.
- Pictures show in the bill's item grid, the catalog list (every row then
  leads with the same slot, a picture or the tag icon, so names line up),
  the item forms and the name suggestions. A list or grid reads the
  library once and hands each row its picture's URL
  (`libraryPictureUrl`). Finito first; Payky's web app follows.

## Alternatives considered

- Copying the picture's URL into the catalog item: a picture drawn again
  would never reach the items made before it, and a retired URL could not
  be fixed.
- Copying it into the `item` snapshot: a sale records name, price and tax
  rate; a picture changes nothing the merchant owes or the customer paid.
- A merchant's own photo: needs blob storage beside Evolu, a separate
  project for later.

## Consequences

- `catalogItem.libraryProductId` is a nullable column; library ids are
  permanent (product-library/0001), so it never dangles by a rename.
- Without the library loaded, offline on a first start or with the host
  down, every item shows as it did before pictures.
- Finito caches pictures with expo-image's memory and disk cache, keyed by
  their content-addressed URL.

## Enforced by

- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > catalog item library product > an item created without a library product has none`
- `packages/core/src/modules/catalog-item/catalog-item-actions.test.ts > catalog item library product > renaming an item keeps its library product, and clearing it removes it`
- `packages/app-shared/src/library-product-prefill.test.ts > a create form's link to the library product picked > holds while the name contains the product's name in any language or a synonym`
- `packages/app-shared/src/library-product-prefill.test.ts > a create form's link to the library product picked > drops once the name no longer names the product, or is emptied`
- `packages/core/src/integrations/product-library/product-library-client.test.ts > libraryImageUrl > picks the smallest published size at least as large as asked`
- `packages/core/src/integrations/product-library/product-library-client.test.ts > libraryImageUrl > falls back to the largest size when none is large enough`
- `packages/core/src/integrations/product-library/product-library-client.test.ts > libraryImageUrl > has no URL when the library publishes no sizes`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > findLibraryProduct > finds a product by id, a retired one included`
- `packages/core/src/integrations/product-library/product-library-utils.test.ts > findLibraryProduct > finds nothing for an unknown id`
