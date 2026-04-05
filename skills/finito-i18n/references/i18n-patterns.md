# Finito i18n Patterns

Use this reference when adding or refactoring translations.

## Architecture

Translation stack:

- `react-i18next` and `i18next` provide runtime translation.
- `lib/i18n/client.ts` initializes i18next and language switching.
- `components/i18n-provider.tsx` wraps the app and reacts to language changes.
- `components/language-toggle.tsx` switches between `en` and `cs`.
- `lib/i18n/config.ts` defines supported languages and namespace registry.
- `lib/i18n/resources.ts` maps namespaces to locale files for each language.

Locale files live in:

- `locales/en/<namespace>.ts`
- `locales/cs/<namespace>.ts`

## Namespace and Key Shape

Current convention:

- Access keys with `t("namespace:path.to.leaf")`.
- Use nested objects in locale files and dot notation in `t(...)`.
- Keep key trees identical between EN and CS.

Examples:

- `t("common:actions.retry")`
- `t("components:dataTable.filterPlaceholder", { title })`
- `t("payments:detail.status.paid")`

Dynamic-key examples in code:

- `t(\`payments:detail.status.${paymentStatus}\`)`
- `t(\`client:historyDetail.status.${paymentStatus}\`)`
- `t(\`app:onboarding.restore.errors.${errorKey}\`)`

When adding a new dynamic branch, ensure every possible runtime suffix has a locale key.

## Naming Conventions in Locale Files

Observed style:

- Root and grouping segments are usually camelCase (`paymentForm`, `settings`, `actions`).
- Many leaf keys use kebab-case for long labels (`show-fullscreen-qr-payment`).
- Numeric key segments are allowed in special cases (`placeholder.0`, `placeholder.1`).

Do not rename key segments casually. Existing `t(...)` usage is string-based, so rename operations require synchronized source updates.

## Adding a New Key

1. Identify namespace from call site or feature area.
2. Add key path in `locales/en/<namespace>.ts`.
3. Add the same key path in `locales/cs/<namespace>.ts`.
4. Use the key in UI/business code through `t(...)`.
5. Run validator script.

## Adding a New Namespace

1. Create files:
- `locales/en/<namespace>.ts`
- `locales/cs/<namespace>.ts`

2. Register namespace in:
- `lib/i18n/config.ts` in `I18N_NAMESPACES`
- `lib/i18n/resources.ts` imports and `resources.en` + `resources.cs`

3. Use the namespace in code:
- `t("<namespace>:...")` or `useTranslation("<namespace>")`

4. Run validator script.

## Validation

Run:

```bash
bun skills/finito-i18n/scripts/validate-locales.mjs
```

The script checks:

- Namespace parity between config and locale files.
- Namespace parity between `en` and `cs` resources mapping.
- Leaf-key parity between `locales/en` and `locales/cs` for each namespace.

