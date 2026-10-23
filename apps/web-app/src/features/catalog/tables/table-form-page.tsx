import type { UpdateValues } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { requiredTextCodec } from "@payky/app-shared/inline-edit-codecs"
import { parseTableForm } from "@payky/app-shared/table-form"
import { PositiveIntegerSchema } from "@payky/core/modules/shared/schema"
import type { Table, TableRow } from "@payky/core/modules/table/table"
import {
  createTableAtEnd,
  deleteTable,
  updateTable,
} from "@payky/core/modules/table/table-actions"
import { tableByIdQuery } from "@payky/core/modules/table/table-queries"
import {
  TableId,
  type TableId as TableIdType,
} from "@payky/core/modules/table/table-types"
import { useRouter } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { CatalogFormEmptyState } from "@/features/catalog/catalog-form-empty-state.tsx"
import { TableSelfPayCard } from "@/features/catalog/tables/table-self-pay-card.tsx"
import { FormCard } from "@/features/shared/forms/form-card.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useSettingsForm } from "@/hooks/use-settings-form.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const seatCountCodec = z.codec(z.string(), PositiveIntegerSchema, {
  decode: (value) => Number(value),
  encode: (value) => String(value),
})

export function NewTablePage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("catalog.tables.form.title.create")} />
      <CreateTableForm />
    </>
  )
}

export function EditTablePage({ tableId }: { readonly tableId: string }) {
  const parsedId = TableId.safeParse(tableId)

  if (!parsedId.success) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.tables.form.title.edit"
        messageKey="catalog.tables.form.invalidId"
      />
    )
  }

  return <EditTablePageContent tableId={parsedId.data} />
}

function EditTablePageContent({ tableId }: { readonly tableId: TableIdType }) {
  const { t } = useTranslation()
  const { data } = useEvoluQuery(tableByIdQuery(tableId))
  const [table] = data

  if (table === undefined) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.tables.form.title.edit"
        messageKey="catalog.tables.form.notFound"
      />
    )
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("catalog.tables.form.title.edit")} />
      <EditTableForm table={table} />
    </>
  )
}

/**
 * The create form stays a submit-and-navigate form: there is no row to edit
 * in place yet, so it validates both fields at once and only then inserts.
 */
function CreateTableForm() {
  const runToast = useRunToast()
  const router = useRouter()
  const { t } = useTranslation()
  const formId = useId()
  const [name, setName] = useState("")
  const [seatCount, setSeatCount] = useState("")
  const [nameError, setNameError] = useState<TranslationKey | null>(null)
  const [seatCountError, setSeatCountError] = useState<TranslationKey | null>(
    null
  )
  const { pending, saved, resetSaved, submit } = useSettingsForm()

  return (
    <FormCard
      title={t("catalog.tables.form.card.title")}
      description={t("catalog.tables.form.card.description")}
      savedMessage={saved ? t("catalog.tables.form.saved.create") : null}
      submitLabel={t("catalog.tables.form.save.create")}
      pending={pending}
      onSubmit={(event) => {
        event.preventDefault()
        setNameError(null)
        setSeatCountError(null)
        resetSaved()

        const form = parseTableForm({ name, seatCount })
        if (!form.ok) {
          if (form.field === "name") setNameError(form.errorKey)
          else setSeatCountError(form.errorKey)
          return
        }

        void submit(() =>
          runToast(async (run) => {
            await run.ok(
              createTableAtEnd({
                deviceId: null,
                name: form.name,
                seatCount: form.seatCount,
              })
            )
            router.history.back()
          })
        )
      }}
    >
      <FieldGroup>
        <Field data-invalid={nameError !== null}>
          <FieldLabel htmlFor={`${formId}-name`}>
            {t("catalog.tables.form.name.label")}
          </FieldLabel>
          <Input
            id={`${formId}-name`}
            value={name}
            disabled={pending}
            aria-invalid={nameError !== null}
            autoComplete="off"
            placeholder={t("catalog.tables.form.name.placeholder")}
            onChange={(event) => {
              setName(event.currentTarget.value)
              setNameError(null)
              resetSaved()
            }}
          />
          <FieldError>{nameError ? t(nameError) : null}</FieldError>
        </Field>

        <Field data-invalid={seatCountError !== null}>
          <FieldLabel htmlFor={`${formId}-seatCount`}>
            {t("catalog.tables.form.seatCount.label")}
          </FieldLabel>
          <Input
            id={`${formId}-seatCount`}
            value={seatCount}
            disabled={pending}
            aria-invalid={seatCountError !== null}
            autoComplete="off"
            inputMode="numeric"
            placeholder={t("catalog.tables.form.seatCount.placeholder")}
            onChange={(event) => {
              const nextValue = event.currentTarget.value
              if (/^\d*$/.test(nextValue)) {
                setSeatCount(nextValue)
                setSeatCountError(null)
                resetSaved()
              }
            }}
          />
          <FieldError>{seatCountError ? t(seatCountError) : null}</FieldError>
        </Field>
      </FieldGroup>
    </FormCard>
  )
}

/**
 * The edit form has no submit button: every field saves itself. The row
 * already exists, so each change is an independent update and there is
 * nothing to validate across fields.
 */
function EditTableForm({ table }: { readonly table: TableRow }) {
  const appRun = useAppRun()
  const runToast = useRunToast()
  const confirm = useConfirmDialog()
  const router = useRouter()
  const { t } = useTranslation()
  const formId = useId()

  // `updateTable` is a `Task<_, never>`: its only realistic failure is
  // unexpected infrastructure. `run.ok` throws on any non-ok result too (a
  // disposed run), and `InlineEditField` turns the throw into the toast and
  // withholds its saved tick.
  const saveTable = async (values: Omit<UpdateValues<Table>, "id">) => {
    await using run = appRun()
    await run.ok(updateTable({ id: table.id, ...values }))
  }

  // Not `useConfirmedRun`: `deleteTable` returns a domain Result (it refuses
  // while an open bill still sits on the table, which would strand that bill
  // with no tile in the POS floor view), and that hook only accepts a
  // `never`-error Task.
  const handleDelete = async () => {
    const confirmed = await confirm({
      title: t("catalog.tables.delete.confirm.title", { name: table.name }),
      description: t("catalog.tables.delete.confirm.description", {
        name: table.name,
      }),
      confirmLabel: t("catalog.tables.delete.confirm.confirm"),
      cancelLabel: t("catalog.tables.delete.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return

    await runToast(async (run) => {
      const result = await run(deleteTable(table.id))
      if (!result.ok) {
        // Toasted here, not returned: the message needs the table's name,
        // and `runToast` takes a bare key.
        toast.error(
          t("catalog.tables.delete.hasOpenBills", { name: table.name })
        )
        return
      }

      router.history.back()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("catalog.tables.form.card.title")}</CardTitle>
          <CardDescription>
            {t("catalog.tables.form.card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <InlineEditField
              label={t("catalog.tables.form.name.label")}
              placeholder={t("catalog.tables.form.name.placeholder")}
              defaultValue={table.name}
              codec={requiredTextCodec}
              errorKey="catalog.tables.form.name.invalid"
              onSave={(name) => saveTable({ name })}
            />

            <InlineEditField
              label={t("catalog.tables.form.seatCount.label")}
              placeholder={t("catalog.tables.form.seatCount.placeholder")}
              inputMode="numeric"
              defaultValue={table.seatCount}
              codec={seatCountCodec}
              errorKey="catalog.tables.form.seatCount.invalid"
              onSave={(seatCount) => saveTable({ seatCount })}
            />

            <Field>
              <FieldLabel htmlFor={`${formId}-code`}>
                {t("catalog.tables.form.code.label")}
              </FieldLabel>
              <Input
                id={`${formId}-code`}
                value={table.code}
                disabled
                readOnly
              />
              <FieldDescription>
                {t("catalog.tables.form.code.description")}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <TableSelfPayCard
        table={table}
        onSave={(selfPayEnabled) => saveTable({ selfPayEnabled })}
      />

      <Button
        variant="destructive"
        onClick={() => {
          void handleDelete()
        }}
      >
        <Trash2Icon data-icon="inline-start" />
        {t("catalog.tables.delete")}
      </Button>
    </div>
  )
}
