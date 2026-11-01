import { sqliteTrue } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { upsertAccountEvoluWebsocketTransport } from "@payky/core/evolu/device-account"
import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import { runMutationWithCompletion } from "@payky/core/modules/shared/evolu-utils"
import { WssUrlSchema } from "@payky/core/modules/shared/schema"
import { useAtomValue, useSetAtom } from "jotai"
import Plus from "lucide-react-native/icons/plus"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { deviceEvoluAtom } from "../../../atoms/device-evolu.ts"
import { reloadAppEvoluAtom } from "../../../atoms/evolu-counter.ts"
import { Button } from "../../../components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { appDefaultTransports } from "../../../core/app-brand.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/** Adds an active WebSocket relay and reopens the app database so it syncs through it. */
export function TransportAddForm({
  accountId,
}: {
  readonly accountId: DeviceAccountId
}) {
  const { t } = useTranslation()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const reloadAppEvolu = useSetAtom(reloadAppEvoluAtom)
  const runToast = useRunToast()
  const [url, setUrl] = useState("")
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)

  const submit = async () => {
    setError(null)
    setSaved(false)
    const result = WssUrlSchema.safeParse(url.trim())
    if (!result.success) {
      setError("settings.security.transports.url.invalid")
      return
    }
    setPending(true)
    const ok = await runToast(async () => {
      await runMutationWithCompletion((options) =>
        upsertAccountEvoluWebsocketTransport(
          deviceEvolu,
          { accountId, isActive: sqliteTrue, url: result.data },
          options
        )
      )
      reloadAppEvolu()
      return undefined
    })
    setPending(false)
    if (ok) {
      setUrl("")
      setSaved(true)
    }
  }

  return (
    <YStack gap="3">
      <FieldGroup>
        <Field>
          <FieldLabel>{t("settings.security.transports.url.label")}</FieldLabel>
          <Input
            value={url}
            invalid={error !== null}
            onChangeText={(next) => {
              setUrl(next)
              setError(null)
              setSaved(false)
            }}
            disabled={pending}
            placeholder={appDefaultTransports[0]}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FieldDescription>
            {t("settings.security.transports.url.description")}
          </FieldDescription>
          <FieldError>{error === null ? undefined : t(error)}</FieldError>
        </Field>
      </FieldGroup>
      <XStack items="center" justify="space-between" gap="3">
        {saved ? (
          <Text aria-live="polite">
            {t("settings.security.transports.saved")}
          </Text>
        ) : null}
        <Button
          label={t("settings.security.transports.add")}
          variant="outline"
          iconStart={Plus}
          pending={pending}
          onPress={() => void submit()}
        />
      </XStack>
    </YStack>
  )
}
