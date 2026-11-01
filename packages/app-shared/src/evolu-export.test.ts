import { describe, expect, test } from "vitest"
import { finitoBrand, paykyBrand } from "./brand.ts"
import {
  createEvoluExportFilename,
  formatBytes,
  formatExportCreatedAt,
} from "./evolu-export.ts"

describe("formatBytes", () => {
  test("formats sub-kibibyte sizes in bytes", () => {
    expect(formatBytes(512)).toBe("512 B")
  })

  test("formats kibibytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KiB")
  })

  test("formats mebibytes", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MiB")
  })

  test("formats gibibytes", () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GiB")
  })

  test("formats tebibytes once it exceeds gibibytes", () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024 * 1024)).toBe("2.0 TiB")
  })
})

describe("createEvoluExportFilename", () => {
  test("includes the brand, the database name and a zero-padded timestamp", () => {
    const createdAt = new Date(2026, 0, 5, 9, 3, 7)

    expect(
      createEvoluExportFilename({
        brand: paykyBrand,
        createdAt,
        database: "app",
      })
    ).toBe("payky-evolu-app-export-2026-01-05-090307.sqlite")
    expect(
      createEvoluExportFilename({
        brand: finitoBrand,
        createdAt,
        database: "app",
      })
    ).toBe("finito-evolu-app-export-2026-01-05-090307.sqlite")
  })
})

describe("formatExportCreatedAt", () => {
  // The layout comes from the runtime locale, which the suite does not pin, so
  // a literal expectation would be environment-dependent. Assert what the
  // format options actually promise instead.
  test("shows the calendar date", () => {
    const formatted = formatExportCreatedAt(new Date(2026, 0, 5, 9, 3, 7))

    expect(formatted).toContain("2026")
    expect(formatted).toContain("5")
  })

  test("resolves down to the second, as `timeStyle: medium` promises", () => {
    const at = new Date(2026, 0, 5, 9, 3, 7)
    const aSecondLater = new Date(2026, 0, 5, 9, 3, 8)

    expect(formatExportCreatedAt(at)).not.toBe(
      formatExportCreatedAt(aSecondLater)
    )
  })
})
