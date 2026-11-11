import { createIdFromString, sqliteTrue } from "@evolu/common"
import { createZeroPriceWithoutTaxRateError } from "@payky/core/modules/catalog-item/catalog-item-utils"
import { FiatCurrency } from "@payky/core/modules/shared/schema"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import { describe, expect, test } from "vitest"
import {
  type CatalogItemFormContext,
  type CatalogItemFormInput,
  parseCatalogItemForm,
  priceErrorKey,
  updateCatalogItemErrorKeys,
} from "./catalog-item-form-schema.ts"
import { NO_OPTION } from "./inline-edit-codecs.ts"

const validInput: CatalogItemFormInput = {
  name: "Coffee",
  price: "59",
  description: "",
  internalName: "",
  internalDescription: "",
  sku: "",
  scanCode: "",
}

const taxRateId = createIdFromString<"TaxRate">("standard") as TaxRateId
const vatPayer = { vatPayer: sqliteTrue } as const

const parse = (
  overrides: Partial<CatalogItemFormInput> = {},
  context: Partial<CatalogItemFormContext> = {}
) =>
  parseCatalogItemForm(
    { ...validInput, ...overrides },
    {
      currency: FiatCurrency.CZK,
      taxRateId,
      legalEntity: vatPayer,
      discount: false,
      ...context,
    }
  )

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
    ["negative", "-5"],
    ["more fraction digits than the currency has", "1.234"],
  ])("rejects a price that is %s", (_label, price) => {
    const result = parse({ price })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({ price: "catalog.items.form.price.invalid" })
  })

  test("takes a zero price", () => {
    const result = parse({ price: "0" })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.price).toBe(0)
  })

  test("refuses a VAT payer's zero price without a VAT rate at the price", () => {
    const result = parse({ price: "0" }, { taxRateId: NO_OPTION })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({
      price: "catalog.items.form.price.zeroWithoutTaxRate",
    })
  })

  test("takes a zero price without a VAT rate from an account that is not a VAT payer", () => {
    expect(
      parse({ price: "0" }, { taxRateId: NO_OPTION, legalEntity: undefined }).ok
    ).toBe(true)
  })

  test("takes a VAT payer's positive price without a VAT rate", () => {
    expect(parse({ price: "59" }, { taxRateId: NO_OPTION }).ok).toBe(true)
  })

  test("hands back the VAT rate picked for an item", () => {
    const result = parse()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.taxRateId).toBe(taxRateId)
  })

  test("turns the amount of a discount below zero and drops its VAT rate", () => {
    // The rate picked before the switch was turned on is not the discount's.
    const result = parse({ price: "15.50" }, { discount: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.price).toBe(-1550)
    expect(result.value.taxRateId).toBeNull()
  })

  test("refuses a discount of nothing at the price", () => {
    const result = parse({ price: "0" }, { discount: true })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({
      price: "catalog.items.form.price.discountInvalid",
    })
  })

  test("asks a discount for its amount when the text is no amount", () => {
    const result = parse({ price: "abc" }, { discount: true })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({
      price: "catalog.items.form.price.discountInvalid",
    })
  })

  test("still refuses a signed amount for a discount", () => {
    // The switch carries the sign; the field takes the amount only, and
    // asks for it.
    const result = parse({ price: "-5" }, { discount: true })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({
      price: "catalog.items.form.price.discountInvalid",
    })
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

describe("priceErrorKey", () => {
  test("asks a discount for the amount it takes off, and any other price for a valid one", () => {
    expect(priceErrorKey(true)).toBe("catalog.items.form.price.discountInvalid")
    expect(priceErrorKey(false)).toBe("catalog.items.form.price.invalid")
  })
})

describe("updateCatalogItemErrorKeys", () => {
  // `updateCatalogItem` refuses clearing a free item's VAT rate and making an
  // item without one free alike (catalog-item-actions.test.ts); this is the
  // message both apps' inline edits show for it.
  test("an inline edit of the price or the VAT rate the core refuses shows the create form's own message", () => {
    const formResult = parse({ price: "0" }, { taxRateId: NO_OPTION })
    expect(formResult.ok).toBe(false)
    if (formResult.ok) return

    const refusal = createZeroPriceWithoutTaxRateError()
    expect(updateCatalogItemErrorKeys[refusal.type]).toBe(
      formResult.error.price
    )
  })

  test("a discount given a VAT rate or an update across zero says which rule", () => {
    expect(updateCatalogItemErrorKeys.DiscountWithTaxRate).toBe(
      "catalog.items.form.price.discountWithTaxRate"
    )
    expect(updateCatalogItemErrorKeys.CatalogItemPriceSignChange).toBe(
      "catalog.items.form.price.signChange"
    )
  })

  test("an item deleted meanwhile gets the generic message", () => {
    expect(updateCatalogItemErrorKeys.CatalogItemNotFound).toBe(
      "app.saveFailed"
    )
  })
})
