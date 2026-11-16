# Product library: name suggestions, related items, pictures and starter packs

## Context

A merchant types every catalog item by hand, and nothing in the catalog has a
picture. The goal is a shared, read-only **product library** of typical gastro
products (espresso, cappuccino, pilsner 0.5 l, ...) that:

- suggests an item's name while the merchant types it (autocomplete that
  forgives typos and missing diacritics: "esspreso" finds Espresso),
- after an item is saved, offers related products to add ("Espresso" →
  Cappuccino, Latte, Americano, Flat white),
- gives an item an AI-generated picture, shown in the bill's item grid, the
  catalog list and the item form,
- prefills the item's VAT rate,
- offers a starter pack (Café, Bistro, Bar) during onboarding.

The library lives in its own repository with its own deployment and release
cycle; Payky and Finito read it.

Decisions taken:

- **Library pictures only.** A merchant cannot upload a photo of their own in
  this phase (Evolu holds no blobs; that needs its own storage and is a later,
  separate project).
- **Gastro only.** Retail goods with a barcode stay on the Open Facts lookup
  (`integrations/open-facts`), which this plan leaves as it is.
- **The library carries a VAT rate per country** for each product; the app
  prefills it.
- **No consent switch.** The app downloads the whole library as a static file
  and searches it on the device; nothing the merchant types leaves the
  device, so unlike the Open Facts lookup it needs no opt-in under Privacy.
- **Hosted on Vercel**, as its own Vercel project.
- **Pictures are generated through Codex CLI's image generation** (under the
  team's ChatGPT login, no API key), with the OpenAI Images API
  (`gpt-image-2`) as an alternative backend, and reviewed by a person before
  release.
- **Languages: cs, sk, en.**
- **Starter packs ship in the first phase, with empty prices.** The library
  carries no prices at all.
- **The repository is `product-library`.**

## Why a static file and not a search API

The library is small: hundreds to low thousands of products, about 150 kB of
JSON for all three languages (≈30 kB gzipped). Downloading it whole and
searching locally:

- keeps typed text on the device (no per-keystroke requests, no consent),
- works offline once cached, like the rest of the local-first app,
- answers instantly,
- needs no server, database or monitoring — only static hosting.

A search API would pay off only for a large retail database or suggestions
learned from merchants' data; both are out of scope.

## Naming

"Catalog" already means the merchant's own items (`docs/glossary.md`), and
"product" is used loosely for a catalog item. The shared dataset is therefore
the **product library**, one entry a **library product**, a group of them for
onboarding a **starter pack**. Add these to `docs/glossary.md`. Code uses
`productLibrary` / `libraryProduct` / `starterPack`; the column on the
catalog item is `libraryProductId`.

## Part 1 — the library repository

A new repository `product-library`, Bun + TypeScript, deployed as a static
Vercel project. Its production host is not chosen yet; the app reads it from
`VITE_PRODUCT_LIBRARY_BASE_URL`.

### Layout

```
products/<category>/<id>.yaml   one file per library product
categories.yaml                  category ids and names (cs/sk/en)
packs.yaml                       starter packs
style/image-style.md             the shared visual style every image prompt starts with
images/<id>.webp                 approved master image, 1024 px, committed
contract/v1.ts                   zod schema of the published file (source of truth)
scripts/build.ts                 validate + emit dist/
scripts/image-prompt.ts          prints the full prompt of a product (style + subject)
review/                          small local page listing images awaiting approval
vercel.json
```

Masters are small WebP files (≈60–120 kB); a few hundred products stay well
inside plain git, so no LFS and no external bucket. Revisit if the library
grows past a couple of thousand pictures.

### A library product

```yaml
id: espresso               # stable forever; never renamed or reused
category: coffee
names: { cs: Espresso, sk: Espresso, en: Espresso }
synonyms:
  cs: [presso, kafe, káva, esspreso]
  sk: [presso, kava]
related: [cappuccino, flat-white, americano, cafe-latte, doppio]
vat: { CZ: 1200, SK: 1900 }  # hundredths of a percent, the app's TaxRatePercentage unit
image:
  subject: "a single espresso in a small white ceramic cup on a saucer"
  status: approved          # missing | generated | approved
```

- `vat` values are reviewed by an accountant before a release; the build
  refuses a product without `vat` for every supported country.
- `related` is curated and may be one-directional; the build fails on an
  unknown id.
- Ids are lowercase kebab-case and permanent: a merchant's catalog item keeps
  pointing at one. A product that should disappear is marked
  `retired: true` (still published, never suggested).

### Pictures

- `style/image-style.md` fixes the look once: angle, background, lighting,
  framing, no text or logos. Every prompt is that style plus the product's
  `subject`, so all pictures read as one set.
- `scripts/generate-images.ts` runs `codex exec` per picture by default, or
  with `--backend openai` calls the OpenAI Images API
  (`OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` defaulting to `gpt-image-2`,
  1024×1024, WebP output) for the products it is given.
- The generation workflow: subagents take the products whose `image.status` is
  `missing` (or whose `subject` changed), write/refine the subject, run the
  generator, save `images/<id>.webp` and set `status: generated`. A person
  approves each in `review/` (`status: approved`). Only approved images are
  published; a product without one is published without a picture.
- The build resizes each master to 256 and 512 px WebP and names them by
  content hash: `v1/img/<id>.<hash>-256.webp`.

### The published file

`dist/v1/library.json`, one file for all languages:

```json
{
  "version": "2026.11.1",
  "categories": [{ "id": "coffee", "names": { "cs": "Káva", "sk": "Káva", "en": "Coffee" } }],
  "products": [{
    "id": "espresso", "category": "coffee",
    "names": { "cs": "Espresso", "sk": "Espresso", "en": "Espresso" },
    "synonyms": { "cs": ["presso", "kafe"] },
    "related": ["cappuccino", "americano"],
    "vat": { "CZ": 1200, "SK": 1900 },
    "image": "espresso.3f9a2c"
  }],
  "packs": [{
    "id": "cafe",
    "names": { "cs": "Kavárna", "sk": "Kaviareň", "en": "Café" },
    "products": ["espresso", "cappuccino", "cafe-latte", "croissant"]
  }]
}
```

### Contract and releases

- `/v1/` is the contract. Within `v1` the library may **add** fields and
  products at any time (the app is a tolerant reader and ignores unknown
  fields); renaming or removing a field, or changing its meaning, is a new
  `/v2/`, and `/v1/` stays published for app builds already out there.
- A release is a CalVer `version` in the file and a git tag; merging to `main`
  deploys. Vercel preview deployments give each PR a URL the app can be
  pointed at through its env variable.
- `vercel.json` headers:
  - `/v1/(.*)`: `Access-Control-Allow-Origin: *` (the web app, Finito's PWA
    and the native apps all fetch cross-origin).
  - `/v1/img/(.*)`: `Cache-Control: public, max-age=31536000, immutable`.
  - `/v1/library.json`: `Cache-Control: public, max-age=300,
    stale-while-revalidate=86400`.
- CI runs the build (validation) on every PR.

## Part 2 — Payky and Finito

### Core

`packages/core/src/integrations/product-library/`:

- `product-library-client.ts`: the consumer's zod schema of `v1` (only the
  fields it reads), a config dep `ProductLibraryDep` carrying the base URL
  (`createProductLibraryDep`, as `createYadioApiDep`), and
  `loadProductLibrary` — a Task over `FetchDep` through
  `fetchAndValidateJson`, with `defineError` errors carrying `status` and
  `responseBody`. `libraryImageUrl(dep, image, size)` builds a picture URL.
- `product-library-search.ts`: a pure `searchLibraryProducts(library, {
  query, language, limit })`. Folds the query and the names/synonyms with
  `foldDiacritics` (`packages/core/src/utils/sql-text-search.ts`), then ranks:
  exact name, name prefix, word prefix, synonym prefix, substring, and a
  Damerau–Levenshtein distance of 1 (query ≥ 4 chars) or 2 (≥ 7). Retired
  products never match. Written in-house: the data is small, the ranking is
  ours to test, and core takes no new dependency.
- `product-library-utils.ts`: `relatedSuggestions(library, product,
  catalogLibraryIds)` (related products not yet in the catalog) and
  `vatRateFor(product, country, taxRates)` — the account's active `taxRate`
  whose `rate` equals the library's value, or `undefined` (then the form
  keeps its default; a non-VAT-payer account has no rates and gets none).
- Tests beside each file, with a fixture `library.json`.

### Schema

- `catalogItem.libraryProductId: NonEmptyString255Schema.nullable()`
  (`packages/core/src/modules/catalog-item/catalog-item.ts`). It names the
  library product the item came from; the picture is resolved through the
  loaded library, so a re-generated picture reaches existing items. Not
  copied into the `item` snapshot: a picture is not part of what was sold.
- Create/update actions in `catalog-item-actions.ts` accept it; editing the
  name keeps it, an explicit "remove picture" clears it.

### Loading and caching

- App env: `VITE_PRODUCT_LIBRARY_BASE_URL` in `apps/web-app/src/core/app-env.ts`
  and the native app's env, defaulting to the production host.
- One `useProductLibrary()` hook per app over `useQuery` (stable key, long
  `staleTime`), loading lazily the first time a screen needs it. A failed load
  simply means no suggestions and no pictures — never an error toast.
- Web: add workbox `runtimeCaching` for the library origin in
  `apps/web-app/vite.config.ts` — `StaleWhileRevalidate` for `library.json`,
  `CacheFirst` for `v1/img/` — so both survive offline.
- Native: add `expo-image` (disk cache) for pictures; keep the last
  `library.json` in the app's cache directory so suggestions work offline.

### UI (both apps, kept in parity)

1. **Name autocomplete** in the item forms (`features/catalog/items/item-form-page.tsx`,
   `features/bill/create-catalog-item-dialog.tsx`, and their Finito twins).
   The name field shows up to ~6 suggestions with thumbnail and category
   under it; typing on ignores them and saves exactly what was typed. Picking
   one fills the name, `libraryProductId`, the VAT rate (`vatRateFor`) and
   offers the library category in the category combobox (an existing
   category of that name, else "Add “name”", per catalog/0004). Price is
   never prefilled. Build it from the vendored `combobox.tsx` in its
   free-text mode (web) and the kit's `combobox.tsx` (native); if the
   vendored primitive cannot do free text, adapt at the call site — never
   edit `components/ui`.
2. **Related suggestions.** After a create form saves an item that has a
   `libraryProductId`, a row of chips "Add also: Cappuccino · Latte · …"
   shows the `relatedSuggestions`. A chip opens the create form prefilled
   (name, picture, VAT, same category) with the price empty, so every added
   item gets a price from the merchant.
3. **Pictures.** A square thumbnail in the bill's item grid
   (`features/bill`, `item-brick-grid*`), the catalog list
   (`features/catalog/items/items-list.tsx`) and the item form, with a
   "Remove picture" action. An item without one renders as today.
4. **Starter packs in onboarding.** On the last step (onboarding/0012), when
   the merchant chooses "bills built from items", a pack picker appears:
   Café / Bistro / Bar / Start empty (nothing preselected beyond "Start
   empty"). The picked pack's products are listed with checkboxes and an
   empty price field each; finishing stays unavailable until every checked
   product has a price (unchecking one is the way to skip it), so nothing is
   ever sold at a price the merchant did not type. `finishOnboarding` creates the checked ones in its
   existing batch, with categories from the library and VAT mapped against
   the tax rates it seeds for the account's country. If the library is not
   loaded (offline), the picker is not shown and onboarding is unchanged.
   Accounts opened from restore/transfer never see it.

### Translations

New keys under `catalog.library.*` and `onboarding.starterPack.*` in
`packages/app-shared/src/i18n/<lang>/` group files (cs, sk, en). Product and
category names come from the library itself, not from translation keys.

### Decision records

- `catalog/0005` — item names are suggested from the product library, which
  the device downloads whole and searches locally; typed text never leaves
  the device, so no consent switch.
- `catalog/0006` — an item's picture comes from the library only, referenced
  by `libraryProductId`; a merchant's own photo is out of scope.
- `catalog/0007` — a saved library item offers its related products; an added
  one is never priced by the library.
- `catalog/0008` — a library product prefills the VAT rate matching its
  percentage for the account's country, else the form's default.
- `onboarding/0013` — onboarding offers a starter pack when the business
  sells from items.

Each names its tests under `## Enforced by`.

### Docs

- `docs/product-library.md`: the contract, the host, how to point a dev build
  at a preview deployment.
- `docs/glossary.md`: product library, library product, starter pack.
- `AGENTS.md`: a line for `integrations/product-library/` in Project
  Structure.

## Order of work

1. Library repo: contract, ~50 products for the three packs, style guide,
   build, Vercel project. Release `v1` without pictures.
2. Core: client, search, utils, `libraryProductId`, tests.
3. Web: autocomplete, related chips, pictures, caching; then Finito.
4. Pictures: generate and approve the first set; release.
5. Onboarding starter packs (web, then Finito).
6. Decision records, glossary, docs; e2e for autocomplete and onboarding
   (the e2e server serves a fixture library).

## Open questions

- The library's production host name.

## Implementation status

As of 2026-11-16, on `feat/product-library`.

Done:

- The library repository (`github.com/finitoapp/product-library`): the `v1`
  contract, 76 products in ten categories with cs/sk/en names and
  synonyms, the Café, Bistro and Bar packs, the build and the review page,
  deployed to `https://product-library-chi.vercel.app`, which answers the
  open question of the host. Pictures are generated through Codex CLI's
  image generation by default (`--backend openai` keeps the Images API);
  every product has a `generated` picture.
- Core: the client, search and utils, `catalogItem.libraryProductId`,
  `createCatalogItemsAtEnd`, `findActiveTaxRateByPercentage`, and
  `finishOnboarding`'s starter items; app-shared's form prefill and starter
  pack state.
- Finito: loading with the offline copy, `EXPO_PUBLIC_PRODUCT_LIBRARY_BASE_URL`
  (production by default, the mock server's 404 in e2e builds), pictures in
  the bill's item grid, the items list and the item forms, name suggestions
  in both create forms, the "Add also" card, and starter packs on
  onboarding's last step.
- Decision records catalog/0005–0007, onboarding/0013 and product-library/0001
  (the plan's catalog/0008 on VAT is part of catalog/0007), the glossary,
  `docs/product-library.md` and `AGENTS.md`.

Not yet:

- The web app (Payky): `VITE_PRODUCT_LIBRARY_BASE_URL`, workbox caching,
  autocomplete, related chips, pictures and starter packs.
- E2E coverage: the mock server serves no fixture library, so no web or
  Maestro flow exercises suggestions, pictures or starter packs.
- Approved pictures: none is approved yet, so production publishes no
  picture and the apps show none.
- The VAT values reviewed by an accountant before a release.
- Connecting the library's Vercel project to its git repository, so merging
  to `main` deploys and pull requests get previews; it is deployed by hand
  so far.
