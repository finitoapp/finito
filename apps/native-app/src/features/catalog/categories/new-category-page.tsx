import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createCatalogCategoryAtEnd } from "@payky/core/modules/catalog-category/catalog-category-actions"
import { NonEmptyString255Schema } from "@payky/core/modules/shared/schema"
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

/** Adds a category, as web's `NewCatalogCategoryPage`: submit, then back. */
export function NewCatalogCategoryPage() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState<TranslationKey | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setNameError(null)
    const parsed = NonEmptyString255Schema.safeParse(name.trim())
    if (!parsed.success) {
      setNameError("catalog.categories.form.name.invalid")
      return
    }
    setPending(true)
    const saved = await runToast(async (run) => {
      await run.ok(
        createCatalogCategoryAtEnd({ deviceId: null, name: parsed.data })
      )
    })
    setPending(false)
    if (saved) router.back()
  }

  return (
    <Screen>
      <FadeHeader title={t("catalog.categories.form.title.create")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("catalog.categories.form.card.title")}</CardTitle>
          <CardDescription>
            {t("catalog.categories.form.card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{t("catalog.categories.form.name.label")}</FieldLabel>
              <Input
                value={name}
                disabled={pending}
                autoCorrect={false}
                placeholder={t("catalog.categories.form.name.placeholder")}
                invalid={nameError !== null}
                onChangeText={(text) => {
                  setName(text)
                  setNameError(null)
                }}
                onSubmitEditing={() => {
                  void submit()
                }}
              />
              <FieldError>
                {nameError === null ? undefined : t(nameError)}
              </FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter justify="flex-end">
          <Button
            label={t("catalog.categories.form.save.create")}
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
