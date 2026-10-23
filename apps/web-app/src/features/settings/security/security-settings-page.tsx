import { useAtomValue } from "jotai"

import { accountAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { EvoluTransportCard } from "@/features/settings/security/evolu-transport-card.tsx"
import { RecoveryBackupCard } from "@/features/settings/security/recovery-backup-card.tsx"
import { SelfPayRelayCard } from "@/features/settings/security/self-pay-relay-card.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

export function SecuritySettingsPage() {
  const { t } = useTranslation()
  const account = useAtomValue(accountAtom)

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.security.title")} />
      <div className="flex flex-col gap-5">
        <RecoveryBackupCard />
        <EvoluTransportCard
          accountId={account.id}
          isDemo={account.demo !== null}
        />
        <SelfPayRelayCard />
      </div>
    </>
  )
}
