import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { requiredPermission } from "../../../core/route-access.ts"

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8")

it("keeps the export owner-only", () => {
  expect(requiredPermission("/settings/evolu-export")).toBe("admin")
})

it("awaits the permission before serializing, then shares", () => {
  const page = read("evolu-export-page.tsx")
  const require = page.indexOf(
    'await require("admin", "access.action.exportDatabase")'
  )
  const serialize = page.indexOf("await evolu.exportDatabase()")
  const share = page.indexOf("await shareFile(")
  expect(require).toBeGreaterThan(-1)
  expect(require).toBeLessThan(serialize)
  expect(serialize).toBeLessThan(share)
  expect(page.match(/evolu\.exportDatabase\(\)/g)).toHaveLength(1)
})

it("keeps the file after a hand-off and reports it neutrally", () => {
  const share = read("../../../platform/share-file-flow.ts")
  const afterShare = share.slice(share.indexOf("await io.share("))
  expect(afterShare).not.toMatch(/removeTemp|finally/u)
  expect(share).toMatch(
    /catch \(error\) \{\s*try \{\s*io\.removeTemp\(folder\)/u
  )
  const page = read("evolu-export-page.tsx")
  expect(page).toContain("settings.evoluExport.status.handedOff")
  expect(page).not.toMatch(/toast\.success|status\.success|status\.createdAt/u)
  const io = read("../../../platform/share-file.ts")
  expect(io).toMatch(/new Directory\(Paths\.cache, folder\)/)
  expect(io).not.toMatch(/Paths\.document|Paths\.bundle|Directory\.pictures/u)
  expect(read("../../../../app/_layout.tsx")).toContain(
    "removeStaleSharedFiles()"
  )
  for (const source of [share, io, page]) {
    expect(source).not.toMatch(
      /console\.|Clipboard|localStorage|AsyncStorage|SecureStore|MMKV|Blob|URL\.createObjectURL/u
    )
  }
})
