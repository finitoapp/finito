import { describe, expect, it } from "vitest"
import { parseTableForm } from "./table-form.ts"

describe("parseTableForm", () => {
  it("accepts a trimmed name and a whole seat count", () => {
    const result = parseTableForm({ name: " Table 5 ", seatCount: "4" })
    expect(result.ok && [result.name, result.seatCount]).toEqual(["Table 5", 4])
  })

  it("reports the name before the seat count", () => {
    expect(parseTableForm({ name: " ", seatCount: "x" })).toMatchObject({
      ok: false,
      field: "name",
    })
  })

  it.each(["", "0", "-1", "1.5", "abc"])("rejects seat count %j", (value) => {
    expect(parseTableForm({ name: "A", seatCount: value })).toMatchObject({
      ok: false,
      field: "seatCount",
      errorKey: "catalog.tables.form.seatCount.invalid",
    })
  })
})
