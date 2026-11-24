# 0007 Finito also speaks Vietnamese

Status: accepted
Date: 2026-11-24

## Context

Many shops and restaurants in Czechia are run by Vietnamese families. The
copy both apps draw from lives in one place (`packages/app-shared/src/i18n`),
in Czech, Slovak and English. The landing, the store listings, the
documentation screenshots and the product library come in those three too.

## Decision

The copy is translated into Vietnamese, and **which languages an app offers
is its brand's** (`Brand.languages`): Finito offers Vietnamese, Payky does
not. A new Finito on a Vietnamese device starts in it; a new Payky there
starts in English, and ignores `?lang=vi`. A Vietnamese device formats dates
and numbers as Vietnam (`vi-VN`) until the merchant picks another region. A
new account still starts Czech, in CZK (onboarding/0001).

The landing, the listings and the screenshots stay in their three languages.

**The product library is read in Czech** on a Vietnamese device
(`libraryLanguage`): it has no Vietnamese names, and an item's name is what
the shop's customers read on the bill. The merchant renames an item freely,
and searching a catalog ignores Vietnamese diacritics as it does Czech ones.

Vietnamese does not decline, so its copy names the app by `{appName}` alone
(brand/0002).

## Alternatives considered

Offering it in Payky as well: the request was Finito's, and Payky's web app
shares its language list with the landing, which is not translated.

Reading the library in English: neither the merchant's language nor the
customers'.

## Consequences

Payky's bundle carries Vietnamese copy it never shows. Every new string needs
a Vietnamese translation; the type checks enforce it as they do for Czech and
Slovak. The privacy policy's contact link leads to the English landing.

## Enforced by

- `packages/app-shared/src/brand.test.ts > brand languages > only Finito offers Vietnamese`
- `apps/native-app/src/core/app-brand.test.ts > the language list offers the brand's languages`
- `packages/web-shared/src/landing-redirect.test.ts > Payky and the landing offer Payky's languages`
- `packages/core/src/modules/device/device-utils.test.ts > getPreferredDeviceLanguage > matches a language only where the app offers it`
- `packages/core/src/integrations/product-library/product-library-search.test.ts > searchLibraryProducts > a Vietnamese device searches the library's Czech names`
- `packages/core/src/utils/sql-text-search.test.ts > foldDiacritics > strips Vietnamese diacritics regardless of case`
