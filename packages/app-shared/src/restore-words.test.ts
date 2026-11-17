import { describe, expect, test } from "vitest"
import {
  analyzeRestoreWords,
  detectForeignSeed,
  emptyRestoreWords,
  fillRestoreWords,
  RESTORE_WORD_COUNT,
  restoreWordsToPhrase,
  splitPhraseInput,
} from "./restore-words.ts"

describe("splitPhraseInput", () => {
  test("splits on whitespace, commas and semicolons and lowercases", () => {
    expect(splitPhraseInput("  Academic,acid;\nACNE  ")).toEqual([
      "academic",
      "acid",
      "acne",
    ])
  })
})

describe("fillRestoreWords", () => {
  test("fans a pasted phrase out over the following slots", () => {
    const fill = fillRestoreWords(emptyRestoreWords(), 2, "academic acid acne")
    expect(fill.words.slice(0, 6)).toEqual([
      "",
      "",
      "academic",
      "acid",
      "acne",
      "",
    ])
    expect(fill.nextIndex).toBe(5)
    expect(fill.overflow).toBe(0)
  })

  test("reports words that found no slot", () => {
    const fill = fillRestoreWords(emptyRestoreWords(), 18, "a b c d")
    expect(fill.words.slice(18)).toEqual(["a", "b"])
    expect(fill.overflow).toBe(2)
    expect(fill.nextIndex).toBe(RESTORE_WORD_COUNT - 1)
  })

  test("stays on the slot while a word is being typed, moves on after a separator", () => {
    expect(fillRestoreWords(emptyRestoreWords(), 0, "acad").nextIndex).toBe(0)
    expect(
      fillRestoreWords(emptyRestoreWords(), 0, "academic ").nextIndex
    ).toBe(1)
    expect(
      fillRestoreWords(emptyRestoreWords(), 0, "academic,").nextIndex
    ).toBe(1)
  })

  test("clears the slot for blank input", () => {
    const words = fillRestoreWords(emptyRestoreWords(), 0, "academic").words
    expect(fillRestoreWords(words, 0, "").words[0]).toBe("")
  })
})

describe("analyzeRestoreWords", () => {
  test("counts filled slots and flags unknown words", () => {
    const words = fillRestoreWords(
      emptyRestoreWords(),
      0,
      "academic zzzz"
    ).words
    const analysis = analyzeRestoreWords(words, null)
    expect(analysis.filledCount).toBe(2)
    expect(analysis.invalidIndexes).toEqual([1])
    expect(analysis.isComplete).toBe(false)
  })

  test("keeps the active slot neutral while it can still become a word", () => {
    const words = fillRestoreWords(emptyRestoreWords(), 0, "acad").words
    const analysis = analyzeRestoreWords(words, 0)
    expect(analysis.invalidIndexes).toEqual([])
    expect(analysis.suggestions).toEqual(["academic"])
  })

  test("limits suggestions to six", () => {
    const words = fillRestoreWords(emptyRestoreWords(), 0, "a").words
    expect(analyzeRestoreWords(words, 0).suggestions).toHaveLength(6)
  })

  test("marks the active slot invalid once nothing can complete it", () => {
    const words = fillRestoreWords(emptyRestoreWords(), 0, "qqq").words
    expect(analyzeRestoreWords(words, 0).invalidIndexes).toEqual([0])
  })

  test("is complete only with 20 known words", () => {
    const words = Array.from({ length: RESTORE_WORD_COUNT }, () => "academic")
    expect(analyzeRestoreWords(words, null).isComplete).toBe(true)
    expect(analyzeRestoreWords(words.slice(1), null).isComplete).toBe(false)
  })
})

describe("restoreWordsToPhrase", () => {
  test("joins the filled slots", () => {
    expect(restoreWordsToPhrase(["a", "", "b"])).toBe("a b")
  })
})

describe("detectForeignSeed", () => {
  test("flags a BIP-39 seed of a BIP-39 length", () => {
    const twelve = Array.from({ length: 12 }, () => "abandon")
    expect(detectForeignSeed(twelve)).toBe(true)
    // One word both lists share does not hide the rest.
    expect(detectForeignSeed(["academic", ...twelve.slice(1)])).toBe(true)
  })

  test("flags BIP-39 words that SLIP-39 does not have", () => {
    expect(detectForeignSeed(["abandon", "ability", "able"])).toBe(true)
  })

  test("leaves a SLIP-39 phrase typed word by word alone at every length", () => {
    for (const length of [12, 15, 18, 21, 24]) {
      expect(detectForeignSeed(Array.from({ length }, () => "academic"))).toBe(
        false
      )
    }
  })

  test("leaves a word being typed alone while SLIP-39 can still complete it", () => {
    // "act" is BIP-39, and the start of SLIP-39's "activity" and "actress".
    const words = [...Array.from({ length: 11 }, () => "academic"), "act"]
    expect(detectForeignSeed(words)).toBe(false)
  })

  test("leaves unknown words to the word check", () => {
    expect(detectForeignSeed(Array.from({ length: 24 }, () => "x"))).toBe(false)
  })

  test("leaves SLIP-39 words and empty input alone", () => {
    expect(detectForeignSeed(["academic", "acid"])).toBe(false)
    expect(detectForeignSeed([])).toBe(false)
  })
})
