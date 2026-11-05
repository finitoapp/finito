import { enOnboarding } from "@payky/app-shared/i18n/en/onboarding"
import { AccountShareRefusalSchema } from "@payky/core/integrations/payky-app/account-share-protocol"
import { expect, test } from "vitest"
import { accountFromPaykyFailureKeys } from "./account-from-payky-failures.ts"

test("every reason Payky or the launch can give has its own copy", () => {
  for (const reason of [
    ...AccountShareRefusalSchema.options,
    "cancelled",
    "invalid",
    "notInstalled",
  ] as const) {
    const key = accountFromPaykyFailureKeys[reason]
    expect(enOnboarding[key]).toBeDefined()
  }
  // A malformed request and an unreadable answer read the same to the user;
  // every other reason says what happened.
  const distinct = new Set(Object.values(accountFromPaykyFailureKeys))
  expect(distinct.size).toBe(
    Object.keys(accountFromPaykyFailureKeys).length - 1
  )
})

test("names the source app through its placeholder, never literally", () => {
  for (const key of Object.values(accountFromPaykyFailureKeys)) {
    expect(enOnboarding[key]).not.toMatch(/Payky|Finito/u)
  }
})
