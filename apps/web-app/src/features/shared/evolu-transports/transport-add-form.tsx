import { sqliteTrue } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { upsertAccountEvoluWebsocketTransport } from "@payky/core/evolu/device-account"
import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import { runMutationWithCompletion } from "@payky/core/modules/shared/evolu-utils"
import { WssUrlSchema } from "@payky/core/modules/shared/schema"
import { useAtomValue } from "jotai"
import { Plus } from "lucide-react"
import { useId, useState } from "react"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { Button } from "@/components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { appDefaultTransports } from "@/core/app-brand.ts"
import { useReloadAppEvolu } from "@/hooks/use-reload-app-evolu.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

interface TransportAddFormProps {
  readonly accountId: DeviceAccountId
}

/**
 * Adds an active WebSocket relay to an account and reopens the app database
 * so it starts syncing through it.
 */
export function TransportAddForm({ accountId }: TransportAddFormProps) {
  const { t } = useTranslation()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const reloadAppEvolu = useReloadAppEvolu()
  const runToast = useRunToast()
  const urlInputId = useId()
  const [url, setUrl] = useState<string>("")
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        setError(null)
        setSaved(false)

        const result = WssUrlSchema.safeParse(url.trim())

        if (!result.success) {
          setError("settings.security.transports.url.invalid")
          return
        }

        setPending(true)
        await runToast(async () => {
          await runMutationWithCompletion((options) =>
            upsertAccountEvoluWebsocketTransport(
              deviceEvolu,
              {
                accountId,
                isActive: sqliteTrue,
                url: result.data,
              },
              options
            )
          )

          reloadAppEvolu()
          setUrl("")
          setSaved(true)
        })
        setPending(false)
      }}
    >
      <FieldGroup>
        <Field data-invalid={error !== null}>
          <FieldLabel htmlFor={urlInputId}>
            {t("settings.security.transports.url.label")}
          </FieldLabel>
          <Input
            id={urlInputId}
            value={url}
            disabled={pending}
            aria-invalid={error !== null}
            autoComplete="off"
            inputMode="url"
            placeholder={appDefaultTransports[0]}
            onChange={(event) => {
              setUrl(event.currentTarget.value)
              setError(null)
              setSaved(false)
            }}
          />
          <FieldDescription>
            {t("settings.security.transports.url.description")}
          </FieldDescription>
          <FieldError>{error ? t(error) : null}</FieldError>
        </Field>
      </FieldGroup>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {saved ? t("settings.security.transports.saved") : null}
        </p>
        <Button type="submit" disabled={pending}>
          <Plus data-icon="inline-start" />
          {t("settings.security.transports.add")}
        </Button>
      </div>
    </form>
  )
}
