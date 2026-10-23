import { optionalTextCodec } from "@payky/app-shared/inline-edit-codecs"
import { updateSettings } from "@payky/core/modules/app-settings/app-settings-actions"
import { selfPaySettingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/** The name the guest page shows, as web's `SelfPayGuestNameCard`. */
export function SelfPayGuestNameCard() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const {
    data: [settings],
  } = useEvoluQuery(selfPaySettingsQuery)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("catalog.tables.selfPay.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <InlineEditField
          label={t("catalog.tables.selfPayGuestName.label")}
          description={t("catalog.tables.selfPayGuestName.description")}
          placeholder={t("catalog.tables.selfPayGuestName.placeholder")}
          defaultValue={settings?.selfPayGuestName ?? null}
          codec={optionalTextCodec}
          errorKey="catalog.tables.selfPayGuestName.error"
          onSave={(selfPayGuestName) =>
            runToast(async (run) => {
              await run.ok(updateSettings({ selfPayGuestName }))
            })
          }
        />
      </CardContent>
    </Card>
  )
}
