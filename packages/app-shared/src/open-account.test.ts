import { describe, expect, test } from "vitest"

import { previousOnboardingStep } from "./onboarding-form-state.ts"
import {
  onboardingAccountTypeOfOpenAccountStep,
  onboardingStepOfOpenAccountStep,
  openAccountChoices,
  openAccountStepOfOnboardingStep,
  openAccountSteps,
  parseOpenAccountStep,
} from "./open-account.ts"

describe("openAccountChoices", () => {
  test("offers the easiest way first and the recovery phrase last", () => {
    expect(openAccountChoices({ canRequestFromPayky: true })).toEqual([
      "fromPayky",
      "transfer",
      "phrase",
    ])
  })

  test("offers Payky only where it was detected", () => {
    expect(openAccountChoices({ canRequestFromPayky: false })).toEqual([
      "transfer",
      "phrase",
    ])
  })
})

describe("opening an account in onboarding", () => {
  test.each(openAccountSteps)(
    "the %s step round-trips through the onboarding step",
    (step) => {
      expect(
        openAccountStepOfOnboardingStep(onboardingStepOfOpenAccountStep[step])
      ).toBe(step)
    }
  )

  test.each(["fromPayky", "transfer", "phrase"] as const)(
    "Back from the %s step leads to the chooser, and from there to the welcome screen",
    (step) => {
      const accountType = onboardingAccountTypeOfOpenAccountStep[step]
      expect(
        previousOnboardingStep(
          onboardingStepOfOpenAccountStep[step],
          accountType
        )
      ).toBe("restoreChoice")
      expect(previousOnboardingStep("restoreChoice", accountType)).toBe(
        "accountChoice"
      )
    }
  )

  test("the welcome screen and a restored phrase being set up have no Back", () => {
    expect(previousOnboardingStep("accountChoice", null)).toBeNull()
    expect(previousOnboardingStep("payments", "existingMnemonic")).toBeNull()
    expect(previousOnboardingStep("payments", "new")).toBe("accountChoice")
  })

  test("the setup steps are not part of the flow", () => {
    expect(openAccountStepOfOnboardingStep("accountChoice")).toBeNull()
    expect(openAccountStepOfOnboardingStep("payments")).toBeNull()
  })
})

describe("parseOpenAccountStep", () => {
  test("reads a step and falls back to the chooser", () => {
    expect(parseOpenAccountStep("phrase")).toBe("phrase")
    expect(parseOpenAccountStep("nope")).toBe("choice")
    expect(parseOpenAccountStep(undefined)).toBe("choice")
  })
})
