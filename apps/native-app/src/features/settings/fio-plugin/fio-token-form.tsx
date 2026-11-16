import { parseFioToken } from "@payky/app-shared/fio-token"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { addFioPluginToken } from "@payky/core/modules/fio-plugin/fio-plugin-actions"
import { fioPluginId } from "@payky/core/modules/fio-plugin/fio-plugin-utils"
import Plus from "lucide-react-native/icons/plus"
import { useState } from "react"
import { PasswordTextarea } from "../../../components/password-textarea.tsx"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * Adding a token is its own form, as on web: a field on the basic-settings
 * form would write the token again on every save. The token is a secret: it
 * lives in this component's state only, is entered with secure text entry,
 * and is cleared once stored.
 */
export function FioTokenForm() {
  const runToast = useRunToast()
  const toast = useToast()
  const { t } = useTranslation()
  const [token, setToken] = useState("")
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    const parsed = parseFioToken(token)
    if (!parsed.ok) {
      setError(parsed.errorKey)
      return
    }
    setPending(true)
    const saved = await runToast(async (run) => {
      await run.ok(addFioPluginToken({ fioPluginId, token: parsed.token }))
    })
    setPending(false)
    if (!saved) return
    setToken("")
    setRevealed(false)
    toast.success(t("settings.fioPlugin.tokens.add.saved"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.fioPlugin.tokens.add.title")}</CardTitle>
        <CardDescription>
          {t("settings.fioPlugin.tokens.add.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>{t("settings.fioPlugin.token.label")}</FieldLabel>
            <PasswordTextarea
              shown={revealed}
              onShownChange={setRevealed}
              value={token}
              hideLabel={t("passwordTextarea.hide")}
              showLabel={t("passwordTextarea.show")}
              disabled={pending}
              invalid={error !== null}
              contextMenuHidden
              onChangeText={(text) => {
                setToken(text)
                setError(null)
              }}
            />
            <FieldDescription>
              {t("settings.fioPlugin.token.description")}
            </FieldDescription>
            <FieldError>{error === null ? undefined : t(error)}</FieldError>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter justify="flex-end">
        <Button
          iconStart={Plus}
          label={t("settings.fioPlugin.tokens.add.submit")}
          pending={pending}
          onPress={() => void submit()}
        />
      </CardFooter>
    </Card>
  )
}
