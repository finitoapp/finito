import { describe, expect, test } from "vitest"

import {
  getOnboardingSteps,
  initialOnboardingFormState,
  nextOnboardingStep,
} from "./onboarding-form-state.ts"

describe("getOnboardingSteps", () => {
  test("includes the setup steps for a new account", () => {
    expect(getOnboardingSteps("new")).toEqual([
      "accountChoice",
      "payments",
      "selling",
    ])
  })

  test("opens an existing account through the chooser", () => {
    expect(getOnboardingSteps("restore")).toEqual([
      "accountChoice",
      "restoreChoice",
      "restore",
    ])
    expect(getOnboardingSteps("transfer")).toEqual([
      "accountChoice",
      "restoreChoice",
      "transfer",
    ])
  })

  test("skips the choice step for an already restored phrase", () => {
    expect(getOnboardingSteps("existingMnemonic")).toEqual([
      "payments",
      "selling",
    ])
  })
})

describe("how the business sells (onboarding/0012)", () => {
  test("is asked last when setting up an account, never when opening one", () => {
    expect(nextOnboardingStep("payments", "new")).toBe("selling")
    expect(nextOnboardingStep("payments", "existingMnemonic")).toBe("selling")
    expect(nextOnboardingStep("selling", "new")).toBeNull()
    for (const accountType of ["restore", "transfer", "fromPayky"] as const) {
      expect(getOnboardingSteps(accountType)).not.toContain("selling")
    }
  })

  test("starts with no way of selling chosen and tips on", () => {
    expect(initialOnboardingFormState).toMatchObject({
      homeMode: null,
      tipsEnabled: true,
    })
  })
})
