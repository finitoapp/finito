import { formatDate } from "@payky/app-shared/format-date"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/** Security's recovery-phrase card: only whether the backup was verified, and the way to the backup screen. */
export function RecoveryBackupCard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data: settingsRows } = useEvoluQuery(settingsQuery)
  const verifiedAt = settingsRows[0]?.recoveryPhraseVerifiedAt ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.security.mnemonic.title")}</CardTitle>
        <CardDescription>
          {t("settings.security.backup.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <span
          className="text-sm text-muted-foreground"
          data-testid="recovery-verify-status"
        >
          {verifiedAt === null
            ? t("settings.security.verify.status.unverified")
            : t("settings.security.verify.status.verified", {
                date: formatDate(new Date(verifiedAt), locale),
              })}
        </span>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          render={<Link to="/settings/security/backup" />}
        >
          {t(
            verifiedAt === null
              ? "settings.security.backup.open"
              : "settings.security.backup.view"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
