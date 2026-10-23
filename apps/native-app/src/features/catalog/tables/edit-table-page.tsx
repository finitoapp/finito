import type { UpdateValues } from "@evolu/common"
import {
  positiveIntegerCodec,
  requiredTextCodec,
} from "@payky/app-shared/inline-edit-codecs"
import type { Table, TableRow } from "@payky/core/modules/table/table"
import {
  deleteTable,
  updateTable,
} from "@payky/core/modules/table/table-actions"
import { tableByIdQuery } from "@payky/core/modules/table/table-queries"
import { TableId } from "@payky/core/modules/table/table-types"
import { router, useLocalSearchParams } from "expo-router"
import Trash from "lucide-react-native/icons/trash"
import { YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { CatalogFormEmptyState } from "../catalog-form-empty-state.tsx"
import { TableSelfPayCard } from "./table-self-pay-card.tsx"

/** Edits one table, as web's `EditTablePage`: name and seats save themselves. */
export function EditTablePage() {
  const { tableId } = useLocalSearchParams<{ tableId: string }>()
  const parsedId = TableId.safeParse(tableId)

  if (!parsedId.success) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.tables.form.title.edit"
        messageKey="catalog.tables.form.invalidId"
      />
    )
  }
  return <EditTableLoader id={parsedId.data} />
}

function EditTableLoader({ id }: { readonly id: TableId }) {
  const [table] = useEvoluQuery(tableByIdQuery(id)).data
  if (table === undefined) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.tables.form.title.edit"
        messageKey="catalog.tables.form.notFound"
      />
    )
  }
  return <EditTableForm table={table} />
}

function EditTableForm({ table }: { readonly table: TableRow }) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirm = useConfirm()
  const toast = useToast()

  // `updateTable` is a `Task<_, never>`: `run.ok` throws on an unexpected
  // failure and `useRunToast` turns that into the toast.
  const saveTable = (values: Omit<UpdateValues<Table>, "id">) =>
    runToast(async (run) => {
      await run.ok(updateTable({ id: table.id, ...values }))
    })

  // Not `useConfirmedRun`: `deleteTable` returns a domain Result (it refuses
  // while an open bill still sits on the table, which would strand that bill
  // with no tile in the POS floor view).
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

    let deleted = false
    const ran = await runToast(async (run) => {
      const result = await run(deleteTable(table.id))
      if (!result.ok) {
        // Toasted here: the message needs the table's name, and `runToast`
        // takes a bare key.
        toast.error(
          t("catalog.tables.delete.hasOpenBills", { name: table.name })
        )
        return
      }
      deleted = true
    })
    if (ran && deleted) router.back()
  }

  return (
    <Screen>
      <FadeHeader title={t("catalog.tables.form.title.edit")} />
      <YStack gap={20}>
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
                keyboardType="number-pad"
                defaultValue={table.seatCount}
                codec={positiveIntegerCodec}
                errorKey="catalog.tables.form.seatCount.invalid"
                onSave={(seatCount) => saveTable({ seatCount })}
              />
              <Field>
                <FieldLabel>{t("catalog.tables.form.code.label")}</FieldLabel>
                <Input value={table.code} disabled readOnly />
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
          label={t("catalog.tables.delete")}
          iconStart={Trash}
          variant="destructive"
          onPress={() => {
            void handleDelete()
          }}
        />
      </YStack>
    </Screen>
  )
}
