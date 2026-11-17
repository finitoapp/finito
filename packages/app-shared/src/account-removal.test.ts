import { describe, expect, it } from "vitest"
import { accountRemovalStep } from "./account-removal.ts"

const active = {
  active: true,
  demo: false,
  otherDevices: 0,
  backupVerified: false,
}

describe("accountRemovalStep", () => {
  it("asks for the backup before removing the only copy of an account", () => {
    expect(accountRemovalStep(active)).toBe("backupFirst")
  })

  it("removes an account its other devices keep", () => {
    expect(accountRemovalStep({ ...active, otherDevices: 2 })).toBe(
      "otherDevices"
    )
  })

  it("removes the only copy once its recovery phrase is backed up", () => {
    expect(accountRemovalStep({ ...active, backupVerified: true })).toBe(
      "phraseOnly"
    )
  })

  it("warns about the phrase for a demo or an inactive account, whose devices are unknown here", () => {
    expect(accountRemovalStep({ ...active, demo: true })).toBe("phraseOnly")
    expect(accountRemovalStep({ ...active, active: false })).toBe("phraseOnly")
  })
})
