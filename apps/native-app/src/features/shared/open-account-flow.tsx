import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { OpenAccountStep } from "@payky/app-shared/open-account"
import { AccountFromPayky } from "./account-from-payky.tsx"
import { AccountTransferTarget } from "./account-transfer-target.tsx"
import { OpenAccountChoice } from "./open-account-choice.tsx"
import { RestoreAccountStep } from "./restore-account-step.tsx"

/**
 * Opening an account the user already has (onboarding/0011): the chooser,
 * then the one way picked. Onboarding keeps the step in `onboardingFormAtom`,
 * Settings in its route, so the step comes from outside; each host draws the
 * step's heading from `openAccountStepCopy`.
 */
export function OpenAccountFlow({
  step,
  onStepChange,
  source,
  confirmBeforeAdding,
  disabled = false,
  restore,
}: {
  readonly step: OpenAccountStep
  readonly onStepChange: (step: OpenAccountStep) => void
  readonly source: "onboarding" | "settings"
  /** A device that already has an account confirms before adding another. */
  readonly confirmBeforeAdding: boolean
  readonly disabled?: boolean
  /** The recovery phrase step's state, from `useRestoreAccount`. */
  readonly restore: {
    readonly error: TranslationKey | null
    readonly pending: boolean
    readonly onRestore: (phrase: string) => void
  }
}) {
  if (step === "choice") {
    return <OpenAccountChoice disabled={disabled} onSelect={onStepChange} />
  }
  if (step === "fromPayky") {
    return (
      <AccountFromPayky
        source={source}
        confirmBeforeAdding={confirmBeforeAdding}
      />
    )
  }
  if (step === "transfer") {
    return (
      <AccountTransferTarget
        source={source}
        confirmBeforeAdding={confirmBeforeAdding}
        // Straight to the phrase: who cannot scan knows what they want.
        onRestoreWithPhrase={() => onStepChange("phrase")}
      />
    )
  }
  return (
    <RestoreAccountStep
      error={restore.error}
      pending={restore.pending}
      submitFullWidth
      onRestore={restore.onRestore}
    />
  )
}
