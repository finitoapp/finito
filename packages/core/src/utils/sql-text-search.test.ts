import { describe, expect, test } from "vitest"

import { escapeLikePattern, foldDiacritics } from "./sql-text-search.ts"

describe("foldDiacritics", () => {
  test("lowercases plain ASCII text", () => {
    expect(foldDiacritics("Coffee")).toBe("coffee")
  })

  test("strips Czech diacritics regardless of case", () => {
    expect(foldDiacritics("Pívo")).toBe("pivo")
    expect(foldDiacritics("PÍVO")).toBe("pivo")
    expect(foldDiacritics("Řízek")).toBe("rizek")
    expect(foldDiacritics("žluťoučký kůň")).toBe("zlutoucky kun")
  })

  test("strips common Western European accents", () => {
    expect(foldDiacritics("café")).toBe("cafe")
    expect(foldDiacritics("Müller")).toBe("muller")
    expect(foldDiacritics("Ñandú")).toBe("nandu")
  })

  test("strips Vietnamese diacritics regardless of case", () => {
    expect(foldDiacritics("Phở bò tái đặc biệt")).toBe("pho bo tai dac biet")
    expect(foldDiacritics("BÚN CHẢ, ĐẬU HŨ")).toBe("bun cha, dau hu")
  })

  test("leaves unmapped characters untouched", () => {
    expect(foldDiacritics("item #42!")).toBe("item #42!")
  })
})

describe("escapeLikePattern", () => {
  test("escapes LIKE wildcard characters", () => {
    expect(escapeLikePattern("50% off_now")).toBe("50\\% off\\_now")
  })

  test("escapes the escape character itself", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b")
  })

  test("leaves plain text untouched", () => {
    expect(escapeLikePattern("coffee")).toBe("coffee")
  })
})
