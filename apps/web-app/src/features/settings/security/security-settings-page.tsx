import { FadeHeader } from "@/components/fade-header.tsx"
import { RecoveryBackupCard } from "@/features/settings/security/recovery-backup-card.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/** Settings → Backup: the recovery phrase of the active account. */
export function SecuritySettingsPage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.backup.title")} />
      <RecoveryBackupCard />
    </>
  )
}
