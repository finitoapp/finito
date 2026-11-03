import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { parseTableForm } from "@payky/app-shared/table-form"
import { createTableAtEnd } from "@payky/core/modules/table/table-actions"
import { router } from "expo-router"
import { useState } from "react"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/** Adds a table, as web's `NewTablePage`: validates both fields, inserts, goes back. */
export function NewTablePage() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [name, setName] = useState("")
  const [seatCount, setSeatCount] = useState("")
  const [nameError, setNameError] = useState<TranslationKey | null>(null)
  const [seatCountError, setSeatCountError] = useState<TranslationKey | null>(
    null
  )
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setNameError(null)
    setSeatCountError(null)
    const form = parseTableForm({ name, seatCount })
    if (!form.ok) {
      if (form.field === "name") setNameError(form.errorKey)
      else setSeatCountError(form.errorKey)
      return
    }
    setPending(true)
    const saved = await runToast(async (run) => {
      await run.ok(
        createTableAtEnd({
          deviceId: null,
          name: form.name,
          seatCount: form.seatCount,
        })
      )
    })
    setPending(false)
    if (saved) router.back()
  }

  return (
    <Screen>
      <FadeHeader title={t("catalog.tables.form.title.create")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("catalog.tables.form.card.title")}</CardTitle>
          <CardDescription>
            {t("catalog.tables.form.card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{t("catalog.tables.form.name.label")}</FieldLabel>
              <Input
                value={name}
                disabled={pending}
                autoCorrect={false}
                placeholder={t("catalog.tables.form.name.placeholder")}
                invalid={nameError !== null}
                onChangeText={(text) => {
                  setName(text)
                  setNameError(null)
                }}
              />
              <FieldError>
                {nameError === null ? undefined : t(nameError)}
              </FieldError>
            </Field>
            <Field>
              <FieldLabel>
                {t("catalog.tables.form.seatCount.label")}
              </FieldLabel>
              <Input
                value={seatCount}
                disabled={pending}
                keyboardType="number-pad"
                placeholder={t("catalog.tables.form.seatCount.placeholder")}
                invalid={seatCountError !== null}
                onChangeText={(text) => {
                  // Digits only, as web's field.
                  if (/^\d*$/u.test(text)) {
                    setSeatCount(text)
                    setSeatCountError(null)
                  }
                }}
                onSubmitEditing={() => {
                  void submit()
                }}
              />
              <FieldError>
                {seatCountError === null ? undefined : t(seatCountError)}
              </FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter justify="flex-end">
          <Button
            label={t("catalog.tables.form.save.create")}
            pending={pending}
            onPress={() => {
              void submit()
            }}
          />
        </CardFooter>
      </Card>
    </Screen>
  )
}
