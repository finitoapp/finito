import { createIdFromString } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { ItemLineType } from "../item/item-types.ts"
import {
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
} from "../shared/schema.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import { TaxRatePercentage } from "../tax-rate/tax-rate-types.ts"
import { allocateDiscount } from "./bill-line-discount-utils.ts"
import { calculateTaxRecap } from "./bill-line-tax-utils.ts"

const standardRateId = createIdFromString<"TaxRate">("standard") as TaxRateId
const reducedRateId = createIdFromString<"TaxRate">("reduced") as TaxRateId
const unknownRateId = createIdFromString<"TaxRate">("unknown") as TaxRateId

const taxRates = [
  {
    id: standardRateId,
    name: NonEmptyString255("Standard rate"),
    rate: TaxRatePercentage(2100),
  },
  {
    id: reducedRateId,
    name: NonEmptyString255("Reduced rate"),
    rate: TaxRatePercentage(1200),
  },
]

describe("calculateTaxRecap", () => {
  test("splits and groups lines by tax rate", () => {
    const rows = calculateTaxRecap(
      [
        {
          taxRateId: standardRateId,
          totalAmount: NonNegativeInteger(12_100),
          discountShare: null,
        },
        {
          taxRateId: reducedRateId,
          totalAmount: NonNegativeInteger(5_600),
          discountShare: null,
        },
      ],
      taxRates
    )

    expect(rows).toEqual([
      {
        taxRateId: standardRateId,
        name: "Standard rate",
        ratePercentage: 2100,
        baseAmount: 10_000,
        taxAmount: 2_100,
        grossAmount: 12_100,
      },
      {
        taxRateId: reducedRateId,
        name: "Reduced rate",
        ratePercentage: 1200,
        baseAmount: 5_000,
        taxAmount: 600,
        grossAmount: 5_600,
      },
    ])
  })

  test("sums multiple lines with the same tax rate", () => {
    const rows = calculateTaxRecap(
      [
        {
          taxRateId: standardRateId,
          totalAmount: NonNegativeInteger(12_100),
          discountShare: null,
        },
        {
          taxRateId: standardRateId,
          totalAmount: NonNegativeInteger(1_210),
          discountShare: null,
        },
      ],
      taxRates
    )

    expect(rows).toEqual([
      {
        taxRateId: standardRateId,
        name: "Standard rate",
        ratePercentage: 2100,
        baseAmount: 11_000,
        taxAmount: 2_310,
        grossAmount: 13_310,
      },
    ])
  })

  test("rounds each line before summing, never the group total", () => {
    // 1_000 at 21% splits to 826 + 174 per line. Rounding the 3_000 group
    // total once would give a base of 2_479 instead of 3 × 826.
    const line = {
      taxRateId: standardRateId,
      totalAmount: NonNegativeInteger(1_000),
      discountShare: null,
    }
    const rows = calculateTaxRecap([line, line, line], taxRates)

    expect(rows).toEqual([
      {
        taxRateId: standardRateId,
        name: "Standard rate",
        ratePercentage: 2100,
        baseAmount: 2_478,
        taxAmount: 522,
        grossAmount: 3_000,
      },
    ])
  })

  test("groups lines with no tax rate into a nameless row", () => {
    const rows = calculateTaxRecap(
      [
        {
          taxRateId: null,
          totalAmount: NonNegativeInteger(500),
          discountShare: null,
        },
      ],
      taxRates
    )

    expect(rows).toEqual([
      {
        taxRateId: null,
        name: null,
        ratePercentage: null,
        baseAmount: 500,
        taxAmount: 0,
        grossAmount: 500,
      },
    ])
  })

  test("orders rows by taxRates' own order, with the no-tax group last", () => {
    const rows = calculateTaxRecap(
      [
        {
          taxRateId: null,
          totalAmount: NonNegativeInteger(100),
          discountShare: null,
        },
        {
          taxRateId: reducedRateId,
          totalAmount: NonNegativeInteger(1_120),
          discountShare: null,
        },
        {
          taxRateId: standardRateId,
          totalAmount: NonNegativeInteger(1_210),
          discountShare: null,
        },
      ],
      taxRates
    )

    expect(rows.map((row) => row.taxRateId)).toEqual([
      standardRateId,
      reducedRateId,
      null,
    ])
  })

  test("excludes lines whose tax rate isn't in taxRates (not yet synced)", () => {
    const rows = calculateTaxRecap(
      [
        {
          taxRateId: unknownRateId,
          totalAmount: NonNegativeInteger(200),
          discountShare: null,
        },
        {
          taxRateId: standardRateId,
          totalAmount: NonNegativeInteger(1_210),
          discountShare: null,
        },
      ],
      taxRates
    )

    expect(rows).toEqual([
      {
        taxRateId: standardRateId,
        name: "Standard rate",
        ratePercentage: 2100,
        baseAmount: 1_000,
        taxAmount: 210,
        grossAmount: 1_210,
      },
    ])
  })

  test("returns nothing for an empty bill", () => {
    expect(calculateTaxRecap([], taxRates)).toEqual([])
  })

  describe("with a discount", () => {
    const line = (
      id: string,
      taxRateId: TaxRateId | null,
      totalAmount: number,
      type: ItemLineType = "catalogItem"
    ) => ({ id, type, taxRateId, totalAmount: Integer(totalAmount) })

    test("counts VAT from the net lines, with no discount row and no rate below zero", () => {
      // A tenth off: 1 210 of the beer, 560 of the soup, 100 of the corkage.
      const rows = calculateTaxRecap(
        allocateDiscount([
          line("a", standardRateId, 12_100),
          line("b", reducedRateId, 5_600),
          line("c", null, 1_000, "manualAmount"),
          line("d", null, -1_870),
        ]),
        taxRates
      )

      expect(rows).toEqual([
        {
          taxRateId: standardRateId,
          name: "Standard rate",
          ratePercentage: 2100,
          baseAmount: 9_000,
          taxAmount: 1_890,
          grossAmount: 10_890,
        },
        {
          taxRateId: reducedRateId,
          name: "Reduced rate",
          ratePercentage: 1200,
          baseAmount: 4_500,
          taxAmount: 540,
          grossAmount: 5_040,
        },
        // The corkage's own share, not the discount itself.
        {
          taxRateId: null,
          name: null,
          ratePercentage: null,
          baseAmount: 900,
          taxAmount: 0,
          grossAmount: 900,
        },
      ])
    })

    test("shows nothing for a discount no goods bear", () => {
      expect(
        calculateTaxRecap(
          allocateDiscount([
            line("a", standardRateId, 0),
            line("b", null, -500),
          ]),
          taxRates
        )
      ).toEqual([])
      // A payment frozen without shares, by an app that knew no discounts.
      expect(
        calculateTaxRecap(
          [
            {
              taxRateId: standardRateId,
              totalAmount: Integer(1_210),
              discountShare: null,
            },
            {
              taxRateId: null,
              totalAmount: Integer(-210),
              discountShare: null,
            },
          ],
          taxRates
        )
      ).toEqual([])
    })
  })
})
