# 0002 Copy names the case the brand name takes

Status: accepted
Date: 2026-11-01

## Context

Czech and Slovak copy uses the app's name in every case: "Aktualizujte
Payky", "kód Payky", "Vítejte v Payky". Payky does not decline, Finito does
like "město": "kód Finita", "ve Finitu". One placeholder for the name would
leave half the Finito copy ungrammatical.

## Decision

A brand carries the forms of its name per language (`BrandNameForms`), and
copy picks the form by placeholder: `{appName}` for the nominative and the
accusative, `{appNameGen}`, `{appNameDat}` and `{appNameLoc}` for the
genitive, dative and locative. A form a brand leaves out reads as the
nominative, so English and Payky give only that.

The prepositions that vocalize by the following word (v/ve, s/se) never
stand right before the name; such copy is reworded ("{appName} vás vítá"
instead of "Vítejte v Payky"). "z" before the genitive stays, as neither
name starts with a sibilant.

Every branded string is rendered for Finito into
`packages/app-shared/src/i18n/brand-copy/finito.<language>.txt`, so review
reads the actual Czech and Slovak.

## Alternatives considered

Rewording all copy around "aplikace {appName}" so the name never declines:
rejected, about twenty strings in each language read stiffly ("Podpořte
vývoj aplikace Finito"). ICU `select` per brand: more machinery than two
brands need.

## Consequences

Writing Czech or Slovak copy that names the app means choosing its case.
Slovak "mimo" takes the genitive where Czech takes the accusative, so the
same English string may use different placeholders per language.

## Enforced by

- `packages/app-shared/src/i18n/brand-copy.test.ts > brand copy > uses only the placeholders a brand fills`
- `packages/app-shared/src/i18n/brand-copy.test.ts > brand copy > puts no name-dependent preposition before the name`
- `packages/app-shared/src/i18n/brand-copy.test.ts > brand copy > declines the name by the case the copy names`
- `packages/app-shared/src/i18n/brand-copy.test.ts > brand copy > renders Finito's %s copy`
