import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { requiredPermission } from "../../../core/route-access.ts"

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8")
const readTransport = (name: string) =>
  readFileSync(
    new URL(`../../shared/evolu-transports/${name}`, import.meta.url),
    "utf8"
  )

it("keeps the backup and backends screens owner-only", () => {
  expect(requiredPermission("/settings/security")).toBe("admin")
  expect(requiredPermission("/settings/backends")).toBe("admin")
})

it("changes transports only through the core device-account writes, then reloads", () => {
  for (const name of ["transport-toggle-list.tsx", "transport-add-form.tsx"]) {
    const source = readTransport(name)
    expect(source).not.toMatch(/deviceEvolu\.(upsert|update|insert)/u)
    expect(source).toMatch(/runMutationWithCompletion/)
    expect(source).toMatch(/reloadAppEvolu\(\)/)
  }
  expect(readTransport("transport-toggle-list.tsx")).toMatch(
    /setAccountEvoluTransportActive\(/
  )
  const add = readTransport("transport-add-form.tsx")
  expect(add).toMatch(/WssUrlSchema\.safeParse\(url\.trim\(\)\)/)
  expect(add.indexOf("WssUrlSchema.safeParse")).toBeLessThan(
    add.indexOf("upsertAccountEvoluWebsocketTransport(")
  )
})

it("keeps the recovery-phrase backup screen owner-only", () => {
  expect(requiredPermission("/settings/security/backup")).toBe("admin")
})

it("shows the recovery phrase only on request, behind the owner permission, never stored or copied", () => {
  const page = read("recovery-backup-page.tsx")
  const grid = read("recovery-words-grid.tsx")
  expect(page).toMatch(
    /await require\("admin", "access\.action\.revealRecoveryPhrase"\)/
  )
  expect(page).toMatch(/state !== "active"\) setStep\("intro"\)/)
  expect(page).not.toMatch(/accessibilityLabel|aria-label/)
  const revealed = page.slice(page.indexOf("function RevealedPhrase"))
  expect(revealed).toMatch(/usePreventScreenCapture\(\)/)
  expect(page).toMatch(/gcTime: 0/)
  expect(grid).toMatch(/userSelect="none"/)
  expect(grid).not.toMatch(/aria-label|accessibilityLabel/)
})

it("offers no way to copy or share the phrase, only the optional verification", () => {
  for (const name of [
    "recovery-backup-page.tsx",
    "recovery-backup-card.tsx",
    "recovery-words-grid.tsx",
    "recovery-verify-step.tsx",
  ]) {
    expect(read(name)).not.toMatch(
      /console\.|Clipboard|Share\b|localStorage|AsyncStorage|SecureStore|MMKV/u
    )
  }
  const verify = read("recovery-verify-step.tsx")
  expect(verify).toMatch(/markRecoveryPhraseVerified\(\)/)
  expect(verify).toMatch(/checkVerifyAnswers\(/)
})
