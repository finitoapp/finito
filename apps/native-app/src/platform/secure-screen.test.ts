import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const setSecure = vi.hoisted(() => vi.fn<(secure: boolean) => void>())
vi.mock("expo", () => ({
  NativeModule: class {},
  requireOptionalNativeModule: () => ({ setSecure }),
}))

const { holdSecureScreen } = await import("./secure-screen.ts")

const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8")
const js = read("./secure-screen.ts")
const moduleDir = "../../modules/payky-secure-screen/android/src/main/"
const kotlin = read(
  `${moduleDir}java/me/payky/securescreen/PaykySecureScreenModule.kt`
)
const manifest = read(`${moduleDir}AndroidManifest.xml`)

describe("holdSecureScreen", () => {
  beforeEach(() => {
    setSecure.mockClear()
  })

  it("protects the window until the last hold is released", () => {
    const first = holdSecureScreen()
    const second = holdSecureScreen()
    expect(setSecure.mock.calls).toEqual([[true]])
    first()
    expect(setSecure.mock.calls).toEqual([[true]])
    second()
    expect(setSecure.mock.calls).toEqual([[true], [false]])
  })

  it("counts a release called twice once", () => {
    const first = holdSecureScreen()
    first()
    const second = holdSecureScreen()
    first()
    expect(setSecure.mock.calls).toEqual([[true], [false], [true]])
    second()
    expect(setSecure.mock.calls).toEqual([[true], [false], [true], [false]])
  })
})

it("names the module and its function the same in JS and Kotlin", () => {
  expect(js).toMatch(
    /requireOptionalNativeModule<PaykySecureScreenNativeModule>\(\s*"PaykySecureScreen"/u
  )
  expect(kotlin).toContain('Name("PaykySecureScreen")')
  expect(js).toContain("setSecure(")
  expect(kotlin).toContain('Function("setSecure")')
})

it("only sets FLAG_SECURE: no screenshot detection and no permission", () => {
  expect(kotlin).toContain("FLAG_SECURE")
  expect(kotlin).not.toMatch(/ScreenCaptureCallback|ContentObserver/u)
  expect(manifest).not.toContain("uses-permission")
})

it("keeps the recovery phrase out of screen capture wherever it is shown or typed", () => {
  const backup = read("../features/settings/security/recovery-backup-page.tsx")
  const revealed = backup.slice(backup.indexOf("function RevealedPhrase"))
  expect(revealed).toMatch(/usePreventScreenCapture\(\)/u)
  const restore = read("../features/shared/restore-account-step.tsx")
  const form = restore.slice(
    restore.indexOf("export function RestoreAccountStep")
  )
  expect(form).toMatch(/usePreventScreenCapture\(\)/u)
  for (const source of [backup, restore]) {
    expect(source).toMatch(/hooks\/use-prevent-screen-capture\.ts"/u)
  }
})
