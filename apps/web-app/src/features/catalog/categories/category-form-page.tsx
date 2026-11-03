import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { requiredTextCodec } from "@payky/app-shared/inline-edit-codecs"
import type { CatalogCategoryRow } from "@payky/core/modules/catalog-category/catalog-category"
import {
  createCatalogCategoryAtEnd,
  deleteCatalogCategory,
  updateCatalogCategory,
} from "@payky/core/modules/catalog-category/catalog-category-actions"
import { catalogCategoryByIdQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import {
  CatalogCategoryId,
  type CatalogCategoryId as CatalogCategoryIdType,
} from "@payky/core/modules/catalog-category/catalog-category-types"
import { NonEmptyString255Schema } from "@payky/core/modules/shared/schema"
import { useRouter } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useId, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { CatalogFormEmptyState } from "@/features/catalog/catalog-form-empty-state.tsx"
import { FormCard } from "@/features/shared/forms/form-card.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmedRun } from "@/hooks/use-confirmed-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useSettingsForm } from "@/hooks/use-settings-form.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function NewCatalogCategoryPage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("catalog.categories.form.title.create")} />
      <CreateCatalogCategoryForm />
    </>
  )
}

export function EditCatalogCategoryPage({
  catalogCategoryId,
}: {
  readonly catalogCategoryId: string
}) {
  const parsedId = CatalogCategoryId.safeParse(catalogCategoryId)

  if (!parsedId.success) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.categories.form.title.edit"
        messageKey="catalog.categories.form.invalidId"
      />
    )
  }

  return <EditCatalogCategoryPageContent catalogCategoryId={parsedId.data} />
}

function EditCatalogCategoryPageContent({
  catalogCategoryId,
}: {
  readonly catalogCategoryId: CatalogCategoryIdType
}) {
  const { t } = useTranslation()
  const { data } = useEvoluQuery(catalogCategoryByIdQuery(catalogCategoryId))
  const [category] = data

  if (category === undefined) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.categories.form.title.edit"
        messageKey="catalog.categories.form.notFound"
      />
    )
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("catalog.categories.form.title.edit")} />
      <EditCatalogCategoryForm category={category} />
    </>
  )
}

/**
 * The create form stays a submit-and-navigate form: there is no row to edit
 * in place yet.
 */
function CreateCatalogCategoryForm() {
  const runToast = useRunToast()
  const router = useRouter()
  const { t } = useTranslation()
  const nameInputId = useId()
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState<TranslationKey | null>(null)
  const { pending, saved, resetSaved, submit } = useSettingsForm()

  return (
    <FormCard
      title={t("catalog.categories.form.card.title")}
      description={t("catalog.categories.form.card.description")}
      savedMessage={saved ? t("catalog.categories.form.saved.create") : null}
      submitLabel={t("catalog.categories.form.save.create")}
      pending={pending}
      onSubmit={(event) => {
        event.preventDefault()
        setNameError(null)
        resetSaved()

        const nameResult = NonEmptyString255Schema.safeParse(name.trim())
        if (!nameResult.success) {
          setNameError("catalog.categories.form.name.invalid")
          return
        }

        void submit(() =>
          runToast(async (run) => {
            await run.ok(
              createCatalogCategoryAtEnd({
                deviceId: null,
                name: nameResult.data,
              })
            )
            router.history.back()
          })
        )
      }}
    >
      <FieldGroup>
        <Field data-invalid={nameError !== null}>
          <FieldLabel htmlFor={nameInputId}>
            {t("catalog.categories.form.name.label")}
          </FieldLabel>
          <Input
            id={nameInputId}
            value={name}
            disabled={pending}
            aria-invalid={nameError !== null}
            autoComplete="off"
            placeholder={t("catalog.categories.form.name.placeholder")}
            onChange={(event) => {
              setName(event.currentTarget.value)
              setNameError(null)
              resetSaved()
            }}
          />
          <FieldError>{nameError ? t(nameError) : null}</FieldError>
        </Field>
      </FieldGroup>
    </FormCard>
  )
}

/**
 * The edit form has no submit button: the name saves itself.
 */
function EditCatalogCategoryForm({
  category,
}: {
  readonly category: CatalogCategoryRow
}) {
  const appRun = useAppRun()
  const confirmedRun = useConfirmedRun()
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("catalog.categories.form.card.title")}</CardTitle>
          <CardDescription>
            {t("catalog.categories.form.card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <InlineEditField
              label={t("catalog.categories.form.name.label")}
              placeholder={t("catalog.categories.form.name.placeholder")}
              defaultValue={category.name}
              codec={requiredTextCodec}
              errorKey="catalog.categories.form.name.invalid"
              onSave={async (name) => {
                await using run = appRun()
                await run.ok(updateCatalogCategory({ id: category.id, name }))
              }}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        onClick={() => {
          void (async () => {
            const deleted = await confirmedRun(
              {
                title: t("catalog.categories.delete.confirm.title", {
                  name: category.name,
                }),
                description: t(
                  "catalog.categories.delete.confirm.description",
                  { name: category.name }
                ),
                confirmLabel: t("catalog.categories.delete.confirm.confirm"),
                cancelLabel: t("catalog.categories.delete.confirm.cancel"),
                variant: "destructive",
              },
              deleteCatalogCategory(category.id)
            )
            if (deleted) router.history.back()
          })()
        }}
      >
        <Trash2Icon data-icon="inline-start" />
        {t("catalog.categories.delete")}
      </Button>
    </div>
  )
}
