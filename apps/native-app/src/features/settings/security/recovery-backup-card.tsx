import { formatDate } from "@payky/app-shared/format-date"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { router } from "expo-router"
import { Text, XStack } from "tamagui"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"

/** Web's `RecoveryBackupCard`: only whether the backup was verified, and the way to the backup screen. */
export function RecoveryBackupCard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [settings] = useEvoluQuery(settingsQuery).data
  const verifiedAt = settings?.recoveryPhraseVerifiedAt ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.security.mnemonic.title")}</CardTitle>
        <CardDescription>
          {t("settings.security.backup.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <XStack items="center" justify="space-between" gap={12}>
          <Text
            flex={1}
            testID="recovery-verify-status"
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {verifiedAt === null
              ? t("settings.security.verify.status.unverified")
              : t("settings.security.verify.status.verified", {
                  date: formatDate(new Date(verifiedAt), locale),
                })}
          </Text>
          <Button
            variant="outline"
            size="sm"
            label={t(
              verifiedAt === null
                ? "settings.security.backup.open"
                : "settings.security.backup.view"
            )}
            onPress={() => router.push("/settings/security/backup")}
          />
        </XStack>
      </CardContent>
    </Card>
  )
}
