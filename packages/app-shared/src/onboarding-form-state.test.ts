import { describe, expect, test } from "vitest"

import { getOnboardingSteps } from "./onboarding-form-state.ts"

describe("getOnboardingSteps", () => {
  test("includes the setup steps for a new account", () => {
    expect(getOnboardingSteps("new")).toEqual(["accountChoice", "payments"])
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
    expect(getOnboardingSteps("existingMnemonic")).toEqual(["payments"])
  })
})
