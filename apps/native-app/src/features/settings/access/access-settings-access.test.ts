import { readFileSync } from "node:fs"
import { expectInOrder } from "@payky/core/testing/source-order"
import { expect, it } from "vitest"

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8")

it("asks for confirmation, awaited, before removing a device, and never for this one", () => {
  const item = read("device-item.tsx")
  expectInOrder(
    item,
    /const remove = async/,
    /await confirm\(/,
    /if \(!confirmed\) return/,
    /await run\.ok\(removeDevice\(device\.id\)\)/
  )
  expect(item).toMatch(/variant: "destructive"/u)
  const removeButton = item.match(
    /\{thisDevice \? null : \(\s*<Button\b([\s\S]*?)\/>/u
  )?.[1]
  expect(removeButton).toMatch(/variant="ghost"/u)
  expect(removeButton).toMatch(/iconStart=\{Trash\}/u)
  expect(removeButton).toMatch(/void remove\(\)/u)
})

it("edits device permissions only through the core action, from the presets and permissions core defines", () => {
  const item = read("device-item.tsx")
  expect(item).toMatch(
    /setDeviceDefaultPermissions\(\{ id: device\.id, permissions: granted \}\)/
  )
  expect(item).toMatch(/accessPresets\[preset\]/)
  expect(item).toMatch(/permissions\.map\(\(permission\)/)
})

it("asks for the current PIN, awaited, before the new one reaches changePin, then clears the digits", () => {
  const card = read("change-pin-card.tsx")
  expectInOrder(
    card,
    /const save = async/,
    /await requirePin\("access\.action\.changePin"\)/,
    /await run\.ok\(changePin\(pin\)\)/,
    /newPin\.clear\(\)/,
    /if \(saved\) onDone\(\)/
  )
  // A refused prompt never reaches the Task.
  expect(card).toMatch(
    /if \(!\(await requirePin\("access\.action\.changePin"\)\)\) \{\s*setPending\(false\)\s*return\s*\}/u
  )
})

it("asks for the current PIN before keeping it, and holds the session from before enabling, dropping it on a failure", () => {
  const wizard = read("turn-on-wizard.tsx")
  expectInOrder(
    wizard,
    /const keepCurrentPin = async/,
    /if \(!\(await requirePin\("access\.action\.enable"\)\)\) return/,
    /setKeepPin\(true\)/
  )
  // Started before the write: the gate must never render the saved rules
  // without it, or it hides this page for a frame (an Android crash).
  expectInOrder(
    wizard,
    /const finish = async/,
    /setSession\(\{ accountId \}\)/,
    /await run\(\s*enableAccessControl\(/,
    /newPin\.clear\(\)/,
    /if \(!saved\) \{\s*setSession\(session\)\s*return\s*\}/,
    /setSession\(\{ accountId \}\)/,
    /onDone\(\)/
  )
  // Devices and their defaults go in the same batch as the PIN.
  expect(wizard).toMatch(/devices: wizardDeviceDefaults\(devices, presets\)/)
})

it("keeps the PIN in component state only: no storage, no logging, no query key", () => {
  for (const file of [
    "change-pin-card.tsx",
    "new-pin-fields.tsx",
    "turn-on-wizard.tsx",
  ]) {
    const source = read(file)
    expect(source, file).not.toMatch(
      /localStorage|AsyncStorage|SecureStore|MMKV|console\.|queryKey|toast\.[a-z]+\([^)]*pin/iu
    )
  }
})

it("asks for the current PIN, awaited, before turning access control off", () => {
  const page = read("access-settings-page.tsx")
  expectInOrder(
    page,
    /const turnOff = async/,
    /if \(!\(await requirePin\("access\.action\.disable"\)\)\) return/,
    /await run\.ok\(disableAccessControl\(\)\)/
  )
})

it("asks for the current PIN, awaited, before unblocking, and only for another blocked device", () => {
  const item = read("device-item.tsx")
  expectInOrder(
    item,
    /const unblock = async/,
    /if \(!\(await requirePin\("access\.action\.unblock"\)\)\) return/,
    /await run\.ok\(unblockDevice\(device\.id\)\)/
  )
  expect(item).toMatch(/device\.pinBlockedAt !== null && !thisDevice/)
})

it("drops the wizard state when the account changes, and shows the wizard only while access is off", () => {
  const page = read("access-settings-page.tsx")
  expect(page).toMatch(/<AccessSettings key=\{accountId\} \/>/)
  expect(page).toMatch(/mode === "wizard" && !enabled \? \(\s*<TurnOnWizard/u)
})
