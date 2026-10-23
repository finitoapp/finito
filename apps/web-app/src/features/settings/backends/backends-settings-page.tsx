import { useAtomValue } from "jotai"

import { accountAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { EvoluTransportCard } from "@/features/settings/backends/evolu-transport-card.tsx"
import { SelfPayRelayCard } from "@/features/settings/backends/self-pay-relay-card.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/** Settings → Backends: the Evolu servers the active account syncs through. */
export function BackendsSettingsPage() {
  const { t } = useTranslation()
  const account = useAtomValue(accountAtom)

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.backends.title")} />
      <EvoluTransportCard
        accountId={account.id}
        isDemo={account.demo !== null}
      />
      <SelfPayRelayCard />
    </>
  )
}
