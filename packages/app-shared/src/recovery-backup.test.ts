import { addDays } from "date-fns"
import { describe, expect, test } from "vitest"
import {
  backupReminderSnoozedUntil,
  checkVerifyAnswers,
  pickVerifyIndexes,
  VERIFY_WORD_COUNT,
} from "./recovery-backup.ts"

const phrase = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ")

describe("pickVerifyIndexes", () => {
  test("returns distinct ascending slots inside the phrase", () => {
    for (let run = 0; run < 50; run++) {
      const slots = pickVerifyIndexes()
      expect(slots).toHaveLength(VERIFY_WORD_COUNT)
      expect(new Set(slots).size).toBe(VERIFY_WORD_COUNT)
      expect([...slots].sort((a, b) => a - b)).toEqual(slots)
      expect(slots.every((slot) => slot >= 0 && slot < 20)).toBe(true)
    }
  })

  test("follows the injected random source", () => {
    expect(pickVerifyIndexes(() => 0)).toEqual([0, 1, 2])
  })
})

describe("checkVerifyAnswers", () => {
  const slots = [3, 10, 16]

  test("accepts the right words, ignoring case and spaces", () => {
    expect(
      checkVerifyAnswers(phrase, slots, ["word3", " WORD10 ", "Word16"])
    ).toBe(true)
  })

  test("rejects a wrong or missing word", () => {
    expect(
      checkVerifyAnswers(phrase, slots, ["word3", "word11", "word16"])
    ).toBe(false)
    expect(checkVerifyAnswers(phrase, slots, ["word3", "", "word16"])).toBe(
      false
    )
    expect(checkVerifyAnswers(phrase, slots, ["word3", "word10"])).toBe(false)
  })

  test("rejects an answer holding several words", () => {
    expect(
      checkVerifyAnswers(phrase, slots, ["word3 word4", "word10", "word16"])
    ).toBe(false)
  })
})

describe("backupReminderSnoozedUntil", () => {
  test("puts the reminder off for a week", () => {
    const now = Date.UTC(2026, 10, 1, 12)
    expect(backupReminderSnoozedUntil(now)).toBe(addDays(now, 7).getTime())
  })
})
