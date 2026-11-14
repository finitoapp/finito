import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8")
const js = read("./nfc.ts")
const kotlin = read(
  "../../modules/finito-nfc/android/src/main/java/fit/finito/nfc/FinitoNfcModule.kt"
)

it("names the module and its event the same in JS and Kotlin", () => {
  expect(js).toContain(
    'requireOptionalNativeModule<FinitoNfcNativeModule>("FinitoNfc")'
  )
  expect(kotlin).toContain('Name("FinitoNfc")')
  expect(js).toContain('"onTagRead"')
  expect(kotlin).toContain('Events("onTagRead")')
})

it("exposes the same functions on both sides", () => {
  for (const fn of [
    "getStatus",
    "startReading",
    "stopReading",
    "openSettings",
  ]) {
    expect(js).toContain(`${fn}(`)
    expect(kotlin).toContain(`Function("${fn}")`)
  }
})
