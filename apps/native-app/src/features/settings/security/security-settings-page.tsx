import { useAtomValue } from "jotai"
import { accountAtom } from "../../../atoms/account.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { RecoveryBackupCard } from "./recovery-backup-card.tsx"

/** Settings → Backup: the recovery phrase of the active account, like web's. */
export function SecuritySettingsPage() {
  const { t } = useTranslation()
  const account = useAtomValue(accountAtom)

  return (
    <Screen>
      <FadeHeader title={t("settings.backup.title")} />
      <RecoveryBackupCard key={account.id} />
    </Screen>
  )
}
