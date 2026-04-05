---
name: finito-i18n
description: Maintain and extend Finito translations built on i18next/react-i18next. Use when editing `locales/{en,cs}/*.ts`, adding or changing translation keys in `t(...)`, introducing or renaming namespaces in `lib/i18n/config.ts` and `lib/i18n/resources.ts`, or debugging missing/misaligned EN/CS locale keys.
---

# Finito I18n

## Overview

Implement translation changes with strict namespace consistency and EN/CS key parity.

Read [references/i18n-patterns.md](references/i18n-patterns.md) before editing translation files.

Run `bun skills/finito-i18n/scripts/validate-locales.mjs` after translation changes.

## Workflow

1. Locate the target namespace:
- Match `t("namespace:path.to.key")` usage to `locales/{en,cs}/namespace.ts`.
- Keep namespace names aligned with `lib/i18n/config.ts` and `lib/i18n/resources.ts`.

2. Edit translations in both languages:
- Apply the same key structure in `locales/en/*.ts` and `locales/cs/*.ts`.
- Keep values localized, but keep key paths identical.
- Keep interpolation placeholders identical across languages (`{{count}}`, `{{title}}`, and similar).

3. Handle namespace-level changes:
- Add new namespace files in both `locales/en` and `locales/cs`.
- Add the namespace to `I18N_NAMESPACES` in `lib/i18n/config.ts`.
- Add imports and resource entries for both languages in `lib/i18n/resources.ts`.

4. Validate consistency:
- Run `bun skills/finito-i18n/scripts/validate-locales.mjs`.
- Fix namespace mismatches and missing keys before finishing.

## Key Files

- `lib/i18n/config.ts`
- `lib/i18n/resources.ts`
- `lib/i18n/client.ts`
- `components/i18n-provider.tsx`
- `components/language-toggle.tsx`
- `locales/en/*.ts`
- `locales/cs/*.ts`

## Output Contract

When asked to update translations in Finito, produce:
- Updated `t(...)` usage and matching locale keys.
- Mirrored EN/CS key trees for every changed namespace.
- Namespace registration updates in config/resources when needed.
- Passing result from `validate-locales.mjs`.
