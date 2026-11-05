import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { OpenAccountStep } from "@payky/app-shared/open-account"
import { AccountTransferTarget } from "@/features/shared/account/account-transfer-target.tsx"
import { OpenAccountChoice } from "@/features/shared/account/open-account-choice.tsx"
import { RestoreAccountForm } from "@/features/shared/account/restore-account-form.tsx"

/**
 * Opening an account the user already has (onboarding/0011): the chooser,
 * then the one way picked. Onboarding keeps the step in `onboardingFormAtom`,
 * Settings in its route's search, so the step comes from outside; each host
 * draws the step's heading from `openAccountStepCopy`. Web never offers the
 * request to Payky (account/0008), so that step shows the chooser.
 */
export function OpenAccountFlow({
  step,
  onStepChange,
  source,
  confirmBeforeAdding,
  chooserClassName,
  restore,
}: {
  readonly step: OpenAccountStep
  readonly onStepChange: (step: OpenAccountStep) => void
  readonly source: "onboarding" | "settings"
  /** A device that already has an account confirms before adding another. */
  readonly confirmBeforeAdding: boolean
  readonly chooserClassName?: string
  /** The recovery phrase step's state, from `useRestoreAccount`. */
  readonly restore: {
    readonly error: TranslationKey | null
    readonly words: ReadonlyArray<string>
    readonly pending: boolean
    readonly onWordsChange: (words: ReadonlyArray<string>) => void
    readonly onRestore: () => void
  }
}) {
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
  if (step === "phrase") {
    return (
      <div className="[&_button[type=submit]]:w-full [&_button[type=submit]]:min-h-11">
        <RestoreAccountForm
          error={restore.error}
          words={restore.words}
          pending={restore.pending}
          onWordsChange={restore.onWordsChange}
          onRestore={restore.onRestore}
        />
      </div>
    )
  }
  return (
    <OpenAccountChoice
      className={chooserClassName}
      pending={restore.pending}
      onSelect={onStepChange}
    />
  )
}
