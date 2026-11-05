import { atom } from "jotai"

export type OnboardingStep =
  | "accountChoice"
  | "payments"
  /** Where the account is now: the chooser before any way of opening it (onboarding/0011). */
  | "restoreChoice"
  /** The recovery phrase. */
  | "restore"
  | "transfer"
  /** The native app's request to Payky on the same phone (account/0008); web never offers it. */
  | "fromPayky"
/**
 * `existingMnemonic` sets up a restored phrase whose relays had no account
 * data (see the restore sync page): the account is already chosen, so it
 * skips the choice step.
 */
export type OnboardingAccountType =
  | "new"
  | "restore"
  | "transfer"
  | "fromPayky"
  | "existingMnemonic"

const onboardingStepsByAccountType = {
  new: ["accountChoice", "payments"],
  restore: ["accountChoice", "restoreChoice", "restore"],
  transfer: ["accountChoice", "restoreChoice", "transfer"],
  fromPayky: ["accountChoice", "restoreChoice", "fromPayky"],
  existingMnemonic: ["payments"],
} satisfies Record<OnboardingAccountType, ReadonlyArray<OnboardingStep>>

export const getOnboardingSteps = (
  accountType: OnboardingAccountType | null
): ReadonlyArray<OnboardingStep> =>
  onboardingStepsByAccountType[accountType ?? "new"]

interface OnboardingFormState {
  readonly step: OnboardingStep
  readonly accountType: OnboardingAccountType | null
  readonly businessName: string
  readonly iban: string
}

export const initialOnboardingFormState: OnboardingFormState = {
  step: "accountChoice",
  accountType: null,
  businessName: "",
  iban: "",
}

export const onboardingFormAtom = atom<OnboardingFormState>(
  initialOnboardingFormState
)

/**
 * The step Back leads to, or `null` where there is none: the welcome screen,
 * and a restored phrase being set up (`existingMnemonic`).
 */
export const previousOnboardingStep = (
  step: OnboardingStep,
  accountType: OnboardingAccountType | null
): OnboardingStep | null => {
  const steps = getOnboardingSteps(accountType)
  const index = steps.indexOf(step)
  return index > 0 ? (steps[index - 1] ?? null) : null
}
