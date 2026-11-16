# 0005 Item names are suggested from the product library, searched on the device

Status: accepted
Date: 2026-11-16

## Context

A merchant typed every catalog item by hand, letter by letter, though a
café's espresso, cappuccino and pilsner are the same in every café. The
product library (`docs/product-library.md`, product-library/0001) is a
shared, read-only list of such gastro products, with their names in every
language the apps speak and the spellings people actually type.

Suggesting from it while the merchant types could be a search request per
keystroke, but that sends what the merchant types to another host. The
Open Facts lookup by barcode does send its query, and for that reason
waits for an opt-in under Privacy (`productLookupEnabled`, off on every
new device). The library is small: hundreds of
products, one JSON file of tens of kilobytes compressed.

## Decision

- **The device downloads the whole library and searches it itself.**
  `loadProductLibrary` reads `v1/library.json` and `searchLibraryProducts`
  ranks its products against what is typed; no request names the query.
  Nothing the merchant types leaves the device, so the suggestions need no
  consent switch and none is offered.
- **The search forgives the way people type.** Case and diacritics never
  matter; a query matches a product's name, the start of one of its words,
  or one of its synonyms in the device's language, best first (an exact
  name, a name prefix, a word prefix, a synonym, a substring, a typo).
  From four letters a typo is allowed, from seven two, counted against the
  start of the name as well, so "esspres" finds Espresso before it is
  typed out. A retired product is never suggested; a blank query suggests
  nothing.
- **The name field suggests, it never decides.** While the name field of an
  item's create form (Settings' new item, the bill's create-item dialog) is
  focused and holds text, up to six library products show under it with
  their picture and library category. Typing on ignores them and the item
  is saved with exactly what was typed; picking one fills the form
  (catalog/0007).
- **A library that does not load is no library.** The app then offers no
  suggestions, pictures or starter packs, exactly as before the library; a
  failed load is never toasted nor reported. Finito keeps the last library
  it downloaded in its cache directory and refreshes it at most hourly, so
  the suggestions work offline after a first load; an unreadable copy is a
  miss and a failed write keeps the older one.
- **Finito first.** Payky's web app follows in a later change, from the
  same core and app-shared code.

## Alternatives considered

- A search API on the library's host: every keystroke would leave the
  device and need a consent switch, and the library would need a server,
  not static hosting. It pays only for a database far larger than a
  gastro list.
- A search library (Fuse.js and the like): the data is small, the ranking
  is ours to test, and core takes no new dependency.
- Suggesting from what other merchants named their items: their catalogs
  are theirs and never leave their devices.

## Consequences

- The library must stay small enough to download whole; a library grown
  far past a few thousand products would reopen this decision.
- A library update reaches the device within the hour it is online (the
  library's own cache headers allow five minutes on top).
- Retail goods with a barcode stay on the Open Facts lookup, which keeps its
  consent.

## Enforced by

- `packages/core/src/integrations/product-library/product-library-client.test.ts > loadProductLibrary > downloads the whole library from v1/library.json`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > finds Espresso from the typo esspreso`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > finds Cappuccino from kapucino, without its diacritics`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > finds the draught lagers from pivo`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > ignores case and diacritics in the query`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > finds a name while it is still being typed with a typo`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > matches the names and synonyms of the language asked for`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > matches the names of the language asked for only`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > ranks an exact name over a name prefix, a word prefix, a synonym, a substring and a typo`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > allows one typo from four letters and two from seven`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > never suggests a retired product`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > suggests nothing for a blank query`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > returns at most limit products`
- `apps/native-app/src/platform/product-library-cache.test.ts > product library cache reads back the library it kept`
- `apps/native-app/src/platform/product-library-cache.test.ts > product library cache reads a file that no longer decodes as a miss`
- `apps/native-app/src/platform/product-library-cache.test.ts > product library cache swallows a failed write and keeps the older copy`
