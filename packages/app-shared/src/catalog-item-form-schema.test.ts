import { FiatCurrency } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import {
  type CatalogItemFormInput,
  parseCatalogItemForm,
} from "./catalog-item-form-schema.ts"

const validInput: CatalogItemFormInput = {
  name: "Coffee",
  price: "59",
  description: "",
  internalName: "",
  internalDescription: "",
  sku: "",
  scanCode: "",
}

const parse = (overrides: Partial<CatalogItemFormInput> = {}) =>
  parseCatalogItemForm({ ...validInput, ...overrides }, FiatCurrency.CZK)

describe("parseCatalogItemForm", () => {
  test("trims text and converts the price to minor units", () => {
    const result = parse({ name: "  Coffee  ", price: "59.50", sku: " A-1 " })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.name).toBe("Coffee")
    expect(result.value.sku).toBe("A-1")
    expect(result.value.price).toBe(5950)
  })

  test("reads a blank optional field as null, not as an error", () => {
    const result = parse({ description: "   " })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.description).toBeNull()
    expect(result.value.internalName).toBeNull()
    expect(result.value.scanCode).toBeNull()
  })

  test("requires a name", () => {
    const result = parse({ name: "   " })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({ name: "catalog.items.form.name.invalid" })
  })

  test.each([
    ["not a number", "abc"],
    ["zero", "0"],
    ["negative", "-5"],
    ["more fraction digits than the currency has", "1.234"],
  ])("rejects a price that is %s", (_label, price) => {
    const result = parse({ price })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({ price: "catalog.items.form.price.invalid" })
  })

  test("rejects optional text over 255 characters", () => {
    const result = parse({ internalDescription: "x".repeat(256) })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({
      internalDescription: "catalog.items.form.internalDescription.invalid",
    })
  })

  // The old field-by-field validation returned on the first failure, so a
  // submit fixed one problem at a time.
  test("reports every invalid field at once", () => {
    const result = parse({ name: "", price: "abc", sku: "y".repeat(256) })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({
      name: "catalog.items.form.name.invalid",
      price: "catalog.items.form.price.invalid",
      sku: "catalog.items.form.sku.invalid",
    })
  })
})
