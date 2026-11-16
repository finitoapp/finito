# Product library

The product library is a shared, read-only list of typical café, bistro and
bar products: their names in Czech, Slovak and English, the spellings people
actually type (typos included), the products a merchant who sells one most
likely sells too, the VAT per country, starter packs, and a picture. It is the
same for every merchant and never carries a price. The apps download it whole
and search it on the device, so nothing a merchant types leaves the device
(`docs/decisions/catalog/0005`).

What the apps do with it:

- suggest an item's name while it is typed, and fill the name, VAT rate and
  category from the product picked, never the price (catalog/0005, 0007);
- show the picture of the library product a catalog item came from,
  through `catalogItem.libraryProductId` (catalog/0006);
- offer the related products of an item just saved (catalog/0007);
- offer a starter pack on onboarding's last step (onboarding/0013).

The words — product library, library product, starter pack — are in
`docs/glossary.md`. Finito has all of it; Payky's web app does not yet.

## Where it lives

The library is its own repository, `github.com/finitoapp/product-library`
(public), and its own Vercel project (product-library/0001). Its data is
YAML (`products/<category>/<id>.yaml`, `categories.yaml`, `packs.yaml`); its
build validates it and writes static files. Nothing runs at request time.

| Host | URL |
| --- | --- |
| Production | `https://product-library-chi.vercel.app` |
| Preview (one per pull request, once the project is connected to the repository) | a `*.vercel.app` URL, behind Vercel's login |

It publishes:

```
GET /v1/library.json                 the whole library
GET /v1/img/<image>-<size>.webp      a product's picture, <size> one of the file's imageSizes (256, 512)
```

`/v1/*` answers with `Access-Control-Allow-Origin: *`, since the PWAs fetch
it cross-origin. `library.json` is cacheable for five minutes and stale for a
day while it revalidates; pictures are named by their content hash
(`<id>.<hash>`) and cached for good.

## The contract

The library's `contract/v1.ts` is the zod schema of `v1/library.json` and its
source of truth: `version` (CalVer `YY.M.MICRO`), `imageSizes`, `categories`,
`products` and `packs`. A product has a permanent `id`, a `category`,
`names` per language, `synonyms`, `related` ids, `vat` per country in
hundredths of a percent (the apps' `TaxRatePercentage` unit, `1200` is
12 %), an `image` (`null` until a picture is approved) and `retired`.

- **Within `v1` the contract only grows.** Fields, products, categories,
  packs, languages and countries may be added at any time. Renaming or
  removing a field, or changing what it means, is a `/v2/` published beside
  `/v1/`, which stays for the app builds already installed.
- **Ids are permanent.** A catalog item stores one. A product the library
  drops is published `retired: true`: an item pointing at it still finds it,
  and it is never suggested, related or packed.
- **The apps are tolerant readers.** `ProductLibrarySchema` in
  `packages/core/src/integrations/product-library/product-library-client.ts`
  names only what the apps read and drops the rest. It reads the
  categories, products and packs entry by entry: one that breaks the
  contract, or that the apps could not store (a product id over 255
  characters), is left out and skipped where it is named, and an empty
  picture reads as none. Only a file whose top level breaks what they read
  is a `ProductLibraryApiError`, which the apps treat as no library.

## In the apps

Core holds what both apps need, in
`packages/core/src/integrations/product-library/`:

- `product-library-client.ts` — `ProductLibrarySchema`,
  `createProductLibraryDep({ baseUrl })`, the `loadProductLibrary` Task over
  `FetchDep`, and `libraryImageUrl`, which picks the smallest published size
  at least as large as the slot.
- `product-library-search.ts` — `searchLibraryProducts`: case and diacritics
  aside, an exact name before a name prefix, a word prefix, a synonym, a
  substring and a typo (one from four letters, two from seven); retired
  products never.
- `product-library-utils.ts` — `findLibraryProduct`, `relatedSuggestions`,
  `libraryVatRateFor` (the account's active rate of the library's
  percentage, through `findActiveTaxRateByPercentage`), `libraryCategoryName`,
  `starterPackProducts`.

`packages/core/src/testing/product-library.ts` is a fixture library for tests.
`packages/app-shared` holds the pure parts of the screens:
`library-product-prefill.ts` (what a create form fills in) and
`onboarding-starter-pack.ts` (the pack's state on onboarding's last step and
the `starterItems` `finishOnboarding` creates).

### Finito

- **Host.** `EXPO_PUBLIC_PRODUCT_LIBRARY_BASE_URL` in
  `apps/native-app/src/core/native-env.ts`, defaulting to the production host.
  The e2e builds and the documentation screenshots set it to the mock
  server's `/product-library` (`apps/native-app/e2e/scripts/point-at-mocks.ts`),
  which answers 404: they run without suggestions, pictures or starter packs
  and never depend on the live library.
- **Loading.** `useProductLibrary()` (`src/hooks/use-product-library.ts`)
  loads it through TanStack Query the first time a screen asks, needs no
  account (onboarding reads it), and refreshes it at most hourly. A failed
  load is never toasted nor reported: the app then behaves as it did before
  the library, and a library already loaded stays.
- **Offline.** On Android the last download is kept in the app's cache
  directory (`src/platform/product-library-cache.ts`,
  `product-library-v1.json`) and answers at once, offline included, while a
  fresh one loads; an unreadable copy is a miss. The PWA keeps nothing
  itself and relies on the browser's HTTP cache
  (`product-library-cache.web.ts`).
- **Pictures.** `LibraryPicture` (`src/components/library-picture.tsx`)
  draws them through expo-image's memory and disk cache, sized for the
  screen's pixel density (`libraryPictureUrl`; a list or grid reads the
  library once and passes each row its URL). They show in the bill's item
  grid, the items list, the item forms, the name suggestions and the
  starter pack. The item forms name the linked library product even when it
  has no picture, with "Unlink from library" (`ItemLibraryPicture`).
- **Screens.** `LibraryNameField` (`src/features/shared/library-name-field.tsx`)
  is the name field of the create forms; `RelatedProductsCard`
  (`src/features/catalog/items/related-products-card.tsx`) the "Add also"
  card on the items list; `StarterPackSection`
  (`src/features/onboarding/starter-pack-section.tsx`) the starter pack.

### Payky

Not yet. The web app will read the host from
`VITE_PRODUCT_LIBRARY_BASE_URL` in `apps/web-app/src/core/app-env.ts` and
cache `library.json` and the pictures through workbox `runtimeCaching`
(`docs/plans/product-library.md`).

## Pointing a dev build elsewhere

Expo inlines `EXPO_PUBLIC_*` at build time, so set the variable before
starting the dev server or exporting:

```sh
EXPO_PUBLIC_PRODUCT_LIBRARY_BASE_URL=http://10.0.2.2:3000 bun run dev:native
```

- **The library on your machine.** In the library's checkout,
  `bun run build` writes `dist/`; serve it with CORS, such as
  `bunx serve --cors -l 3000 dist`. The Android emulator reaches the host as
  `10.0.2.2`, Expo web as `localhost`.
- **A preview deployment.** Previews sit behind Vercel's login, which the app
  cannot pass: either turn off Deployment Protection for the preview, or
  download its `library.json` and pictures and serve them locally as above.
- **No library at all.** Point it at any URL that answers 404; the app then
  behaves as before the library.

Android keeps the last library it loaded in its cache directory; clear the
app's cache (or reinstall) to drop a library from another host at once.

## Changing the library

The library repository's `AGENTS.md` has its rules; in short:

- Add a product as `products/<category>/<id>.yaml` and run `bun run check`
  (lint, types, tests, and the build, which validates the data: unknown or
  retired ids where they would be offered, two active products of one name,
  a VAT missing for a country).
- **VAT** is confirmed by an accountant before a release and the
  confirmation recorded in the release notes. The rule of thumb used so far:
  food and non-alcoholic drinks CZ 12 % / SK 19 %, alcohol CZ 21 % / SK 23 %.
- **Pictures** follow one style (`style/image-style.md`: the style plus the
  product's one-sentence `image.subject`). `bun run images:generate <ids>`
  (or `--missing`) draws them through Codex CLI's built-in image generation
  under a `codex login` ChatGPT session, no API key needed; `--backend
  openai` calls the OpenAI Images API with `OPENAI_API_KEY` instead. Each
  becomes a 1024 px WebP master in `images/` with status `generated`.
  A person approves or rejects each in `bun run images:review`
  (`http://localhost:4321`); only approved pictures are published, and an
  agent never sets `approved`. The build resizes masters to the published
  sizes and names them by content hash, so a picture drawn again reaches
  every item already pointing at its product.
- A release is a CalVer `version` in the library's `package.json`; merging to
  its `main` deploys production once the Vercel project is connected to the
  repository (until then it is deployed by hand, `vercel --prod`).
