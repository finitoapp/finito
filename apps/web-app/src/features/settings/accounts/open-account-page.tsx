import {
  type OpenAccountStep,
  openAccountStepCopy,
} from "@payky/app-shared/open-account"
import { useNavigate } from "@tanstack/react-router"
import { FadeHeader } from "@/components/fade-header.tsx"
import { OpenAccountFlow } from "@/features/shared/account/open-account-flow.tsx"
import { useRestoreAccount } from "@/features/shared/account/use-restore-account.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * `/settings/accounts/open`: adds an account the user already has to this
 * device (onboarding/0011) — the chooser, then another device or the
 * recovery phrase, as onboarding offers them. Each step is its own history
 * entry, so Back walks them.
 */
export function OpenAccountPage({
  step: requestedStep,
}: {
  readonly step: OpenAccountStep
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Web has no app-to-app source (account/0008).
  const step = requestedStep === "fromPayky" ? "choice" : requestedStep
  const copy = openAccountStepCopy[step]
  const { words, pending, error, clearError, setWords, restore } =
    useRestoreAccount()

  const restoreAccount = async () => {
    if (!(await restore())) return
    await navigate({ to: "/restore-account", search: { source: "settings" } })
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t(copy.title)} />
      <div className="flex flex-col gap-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(copy.description)}
        </p>
        <OpenAccountFlow
          step={step}
          source="settings"
          confirmBeforeAdding
          restore={{
            error,
            words,
            pending,
            onWordsChange: setWords,
            onRestore: () => {
              void restoreAccount()
            },
          }}
          onStepChange={(next) => {
            clearError()
            void navigate({
              to: "/settings/accounts/open",
              search: { step: next },
            })
          }}
        />
      </div>
    </>
  )
}
