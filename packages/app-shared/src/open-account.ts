import type { TranslationKey } from "./i18n/resources.ts"
import type {
  OnboardingAccountType,
  OnboardingStep,
} from "./onboarding-form-state.ts"

/**
 * Opening an account the user already has, the same in onboarding and in
 * Settings → Accounts, on web and native (onboarding/0011): first where the
 * account is now, then that one way.
 */
export type OpenAccountStep = "choice" | "fromPayky" | "transfer" | "phrase"
export type OpenAccountSource = Exclude<OpenAccountStep, "choice">

export const openAccountSteps = [
  "choice",
  "fromPayky",
  "transfer",
  "phrase",
] as const satisfies ReadonlyArray<OpenAccountStep>

/**
 * The ways in, easiest first: Payky on this phone (account/0008) asks for no
 * typing, another device for a scan and a code, the recovery phrase for all
 * twenty words. Payky is offered only where it was detected, never as a
 * disabled row.
 */
export const openAccountChoices = ({
  canRequestFromPayky,
}: {
  readonly canRequestFromPayky: boolean
}): ReadonlyArray<OpenAccountSource> =>
  canRequestFromPayky
    ? ["fromPayky", "transfer", "phrase"]
    : ["transfer", "phrase"]

/** The heading and line under it of each step, wherever it is shown. */
export const openAccountStepCopy = {
  choice: {
    title: "openAccount.title",
    description: "openAccount.description",
  },
  fromPayky: {
    title: "accountFromPayky.title",
    description: "accountFromPayky.description",
  },
  transfer: {
    title: "accountTransfer.target.title",
    description: "accountTransfer.target.description",
  },
  phrase: {
    title: "openAccount.phrase.title",
    description: "onboarding.restore.description",
  },
} as const satisfies Record<
  OpenAccountStep,
  { readonly title: TranslationKey; readonly description: TranslationKey }
>

/** How a chooser row reads. */
export const openAccountChoiceCopy = {
  fromPayky: {
    title: "openAccount.fromPayky.title",
    description: "openAccount.fromPayky.description",
  },
  transfer: {
    title: "openAccount.transfer.title",
    description: "openAccount.transfer.description",
  },
  phrase: {
    title: "openAccount.phrase.title",
    description: "openAccount.phrase.description",
  },
} as const satisfies Record<
  OpenAccountSource,
  { readonly title: TranslationKey; readonly description: TranslationKey }
>

/** The onboarding step each part of the flow is, in `onboardingFormAtom`. */
export const onboardingStepOfOpenAccountStep = {
  choice: "restoreChoice",
  fromPayky: "fromPayky",
  transfer: "transfer",
  phrase: "restore",
} as const satisfies Record<OpenAccountStep, OnboardingStep>

/** The account type an onboarding step of the flow belongs to. */
export const onboardingAccountTypeOfOpenAccountStep = {
  choice: "restore",
  fromPayky: "fromPayky",
  transfer: "transfer",
  phrase: "restore",
} as const satisfies Record<OpenAccountStep, OnboardingAccountType>

/** The part of the flow an onboarding step is, or `null` outside it. */
export const openAccountStepOfOnboardingStep = (
  step: OnboardingStep
): OpenAccountStep | null =>
  openAccountSteps.find(
    (candidate) => onboardingStepOfOpenAccountStep[candidate] === step
  ) ?? null

/** A step from a URL, the choice for anything else. */
export const parseOpenAccountStep = (value: unknown): OpenAccountStep =>
  openAccountSteps.find((step) => step === value) ?? "choice"
