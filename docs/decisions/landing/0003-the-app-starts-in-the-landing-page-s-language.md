# 0003 The app starts in the landing page's language

Status: accepted
Date: 2026-10-06

## Context

The landing page's language is the one its address names (landing/0002),
and a visitor may have picked it there. The app's language is a device
setting, written once with the browser's language when the device
database is first created. A new visitor reaches the landing page through
the app's address (landing/0001), which creates that database before the
redirect, so a visitor reading the Czech landing page in an English
browser was then onboarded in English.

## Decision

Every link from the landing page into the web app (the start buttons in
its header and hero, and the browser option of its download section) opens
`/onboarding?lang=<its language>`. Onboarding sets the device's language to it when the device
has no account yet, then drops the parameter from the address, so a reload
or Back does not undo a language picked in onboarding meanwhile. A device
with an account keeps its language and goes on to the app.

## Alternatives considered

Setting the language for every device, which was rejected because a
merchant whose app is set up would have it switched by reading the landing
page in another language.

Reading the language the landing page remembers in `localStorage`, which
was rejected because it is written only when the visitor switches
languages, not for the page they simply opened.

## Consequences

Only the landing page's links carry the language: a visitor who types
the app's address keeps the browser's language. The device locale follows
the language when onboarding finishes, as it already did.

Finito's landing links its PWA, the native app's web build, the same way
(`app.finito.fit/onboarding?lang=`), and its onboarding reads the
parameter as the web app's does. Both read it through `LanguageSchema`
from `@payky/app-shared`, so an unknown value is ignored alike.

## Enforced by

- `apps/web-app/e2e/landing-redirect.spec.ts > the app starts in the language of the landing page it was opened from`
- `apps/web-app/e2e/landing-redirect.spec.ts > a device with an account keeps its language when opened from the landing page`
- `apps/web-app/e2e/landing-redirect.spec.ts > the landing page's start buttons open the app in its language`
- `packages/app-shared/src/i18n/language-schema.test.ts > LanguageSchema > refuses anything else, such as a landing link's unknown or missing language`
