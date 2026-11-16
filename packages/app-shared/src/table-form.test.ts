import { describe, expect, it } from "vitest"
import { parseTableForm } from "./table-form.ts"

describe("parseTableForm", () => {
  it("accepts a trimmed name and a whole seat count", () => {
    const result = parseTableForm({ name: " Table 5 ", seatCount: "4" })
    expect(result.ok && [result.name, result.seatCount]).toEqual(["Table 5", 4])
  })

  it("accepts a table without seats", () => {
    for (const seatCount of ["", "  "]) {
      const result = parseTableForm({ name: "Bar", seatCount })
      expect(result.ok && [result.name, result.seatCount]).toEqual([
        "Bar",
        null,
      ])
    }
  })

  it("reports the name before the seat count", () => {
    expect(parseTableForm({ name: " ", seatCount: "x" })).toMatchObject({
      ok: false,
      field: "name",
    })
  })

  it("rejects a seat count that is not a positive integer", () => {
    for (const seatCount of ["0", "-1", "1.5", "abc", "1e3"]) {
      expect(parseTableForm({ name: "A", seatCount })).toMatchObject({
        ok: false,
        field: "seatCount",
        errorKey: "catalog.tables.form.seatCount.invalid",
      })
    }
  })
})
