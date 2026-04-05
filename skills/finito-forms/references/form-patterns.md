# Finito Form Patterns

Use this reference while implementing or reviewing form files.

## Canonical Skeleton

```tsx
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import {
  NonEmptyStringSchema,
  StringToNullableStringSchema,
} from "@/lib/shared/types";

const formSchema = z.object({
  name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
});

const createDefaultValues = () =>
  ({
    name: "",
  }) satisfies z.input<typeof formSchema>;

const createComponents = (t: TFunction) =>
  createAutoFormLayout(formSchema, ({ builder }) => ({
    ...builder.magicInput("name").text({
      label: t("namespace:form.sample.label.name"),
    }),
  }));

export const SampleForm: React.FC<{
  defaultValues?: PartialDeep<z.input<typeof formSchema>>;
}> = (params) => {
  const { t } = useTranslation();
  const evolu = useEvolu();
  const [defaultValues] = useState(() =>
    merge(createDefaultValues(), params.defaultValues ?? {}),
  );
  const components = useMemo(() => createComponents(t), [t]);
  const form = useActionForm(formSchema, {
    defaultValues,
    saveAction: async (values) => {
      evolu.upsert("sample", {
        id: values.id,
        name: values.name,
      });
    },
  });

  return <AutoForm form={form} components={components} />;
};
```

## Schema Rules

- Define UI-friendly input schema types and convert in schema, not in JSX.
- Use empty-string transformations from `lib/shared/types.ts` for text inputs.
- Prefer branded domain constraints via `.pipe(...)` with shared schemas (`NonEmptyString*`, `EmailSchema`, `PhoneSchema`, etc.).
- Use discriminated unions for mode-dependent fields (`type`, `_tag`, `enable`).
- Use `.transform` only when output type must differ from input representation (for example money/IBAN/date conversions).

## Default Value Rules

- Keep defaults as strings for text/number inputs that render in HTML inputs.
- Mark defaults with `satisfies z.input<typeof schema>`.
- For edit forms, merge defaults with incoming partial values using `merge(...)`.
- Use singleton IDs (`createIdFromString("")`) for app settings rows.
- Use generated IDs (`createId(createRandomBytes())`) for new editable entities and array rows.

## Layout Builder Rules

- Prefer `createAutoFormLayout(schema, ({ builder }) => ({ ... }))`.
- Use `magicInput` for stock inputs:
  - `.text`, `.textarea`, `.date`, `.amount`, `.select`, `.checkbox`, `.nullableSwitch`, `.hidden`.
- Use structural helpers:
  - `line` for multi-column row.
  - `card` / `collapsibleSeparator` / `accordion` for grouped sections.
  - `nestedField` for nested objects.
  - `arrayField` or `arrayTableField` for repeated rows.
  - `when` / `whenNot` for conditional sections.
- Use `createComponent` for custom fields (combobox wrappers, computed values, cross-field synchronization).

## Dynamic Form Behavior

- Read other fields with `useWatch`.
- Write derived values with `useFormContext().setValue`.
- Keep derived-field components inside `builder.createComponent(...)` and return `null` if no visual output is needed.
- Use `form.form.reset(...)` for async hydration from queries when needed.

## Save Action Rules

- Receive transformed output in `saveAction`.
- Use Evolu writes per mutation intent:
  - `upsert`: write whole coherent row state.
  - `update`: partial change or soft delete (`isDeleted: sqliteTrue`).
  - `insert`: create new row with Evolu-generated id.
- For arrays persisted in separate tables:
  - Load original IDs.
  - Upsert submitted rows.
  - Soft-delete removed rows with `update`.
- Trigger optional callbacks (`onSuccess`) after write completion where needed.

## Translation Rules

- Keep user-facing strings in i18n keys via `t(...)`.
- Do not hardcode labels/descriptions unless surrounding file already does it intentionally.

## Quick Checklist

- Schema covers all rendered fields.
- Defaults match `z.input`.
- `createComponents` uses `createAutoFormLayout`.
- Form uses `useActionForm`.
- Component returns `<AutoForm form={form} components={components} />`.
- Save path uses correct Evolu write methods.
- Conditional UI and conditional persistence logic are aligned.
