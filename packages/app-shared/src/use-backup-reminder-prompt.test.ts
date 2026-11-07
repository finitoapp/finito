import { describe, expect, test } from "vitest"
import { decideBackupReminder } from "./use-backup-reminder-prompt.ts"

describe("decideBackupReminder", () => {
  test("opens on entering home when it is due", () => {
    expect(
      decideBackupReminder({
        decision: "closed",
        wasEntered: false,
        entered: true,
        due: true,
      })
    ).toBe("open")
  })

  test("waits on home for the balances, then opens once they are over the line", () => {
    const entered = decideBackupReminder({
      decision: "closed",
      wasEntered: false,
      entered: true,
      due: null,
    })
    expect(entered).toBe("pending")
    expect(
      decideBackupReminder({
        decision: entered,
        wasEntered: true,
        entered: true,
        due: true,
      })
    ).toBe("open")
  })

  test("stays closed when the balances turn out under the line", () => {
    expect(
      decideBackupReminder({
        decision: "pending",
        wasEntered: true,
        entered: true,
        due: false,
      })
    ).toBe("closed")
  })

  test("does not open while home is in use when it becomes due", () => {
    expect(
      decideBackupReminder({
        decision: "closed",
        wasEntered: true,
        entered: true,
        due: true,
      })
    ).toBe("closed")
  })

  test("leaving home drops a decision still waiting for the balances", () => {
    expect(
      decideBackupReminder({
        decision: "pending",
        wasEntered: true,
        entered: false,
        due: null,
      })
    ).toBe("closed")
  })
})
