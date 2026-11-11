import { createIdFromString } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type {
  QerkoBill,
  QerkoReceipt,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import {
  calculateTaxRecap,
  type TaxRecapRow,
} from "../bill-line/bill-line-tax-utils.ts"
import type { ItemId, ItemLineType } from "../item/item-types.ts"
import { createPaymentLineId } from "../payment-line/payment-line-utils.ts"
import { signedDecimalAmountToMinorUnits } from "../shared/money.ts"
import {
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveNumber,
  TimestampMsSchema,
} from "../shared/schema.ts"
import {
  type TaxRateId,
  TaxRatePercentage,
} from "../tax-rate/tax-rate-types.ts"
import {
  calculateQerkoKeypadTaxRecap,
  checkQerkoPaymentStart,
  classifyQerkoPaymentState,
  createQerkoBill,
  createQerkoReceipt,
  deriveQerkoChargedTip,
  deriveQerkoPaymentAttemptState,
  deriveQerkoPaymentContent,
  orderQerkoLines,
  type QerkoLine,
  type QerkoPaymentContent,
  readQerkoTip,
} from "./payment-qerko-payment-utils.ts"
import type { PaymentId } from "./payment-types.ts"

const paymentId = createIdFromString<"Payment">("payment") as PaymentId

const standardRateId = createIdFromString<"TaxRate">("standard") as TaxRateId
const reducedRateId = createIdFromString<"TaxRate">("reduced") as TaxRateId
const zeroRateId = createIdFromString<"TaxRate">("zero") as TaxRateId
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
  {
    id: zeroRateId,
    name: NonEmptyString255("Zero rate"),
    rate: TaxRatePercentage(0),
  },
]

const line = (
  name: string,
  totalAmount: number,
  {
    quantity = 1,
    taxRateId = null,
    type = "catalogItem",
    discountShare = null,
  }: {
    readonly quantity?: number
    readonly taxRateId?: TaxRateId | null
    readonly type?: ItemLineType
    readonly discountShare?: number | null
  } = {}
): QerkoLine => ({
  catalogItemId: null,
  itemId: createIdFromString<"Item">(name) as ItemId,
  type,
  name: NonEmptyStringSchema.decode(name),
  quantity: PositiveNumber(quantity),
  taxRateId,
  totalAmount: Integer(totalAmount),
  discountShare: discountShare === null ? null : Integer(discountShare),
})

const beer = line("Beer", 12_100, { quantity: 2, taxRateId: standardRateId })
const soup = line("Soup", 5_600, { taxRateId: reducedRateId })

/** A tenth off: 1 210 of the beer and 560 of the soup, 159.30 in all. */
const discountedLines: ReadonlyArray<QerkoLine> = [
  { ...beer, discountShare: Integer(-1_210) },
  { ...soup, discountShare: Integer(-560) },
  line("Discount", -1_770),
]

/** A payment of `amount`, `tipAmount` of it the tip set on Payky's screen. */
const content = (
  amount: number,
  lines: ReadonlyArray<QerkoLine>,
  tipAmount = 0
): QerkoPaymentContent =>
  deriveQerkoPaymentContent({
    amount: NonNegativeInteger(amount),
    tipAmount: NonNegativeInteger(tipAmount),
    lines,
  })

const bill = (paymentContent: QerkoPaymentContent): QerkoBill =>
  createQerkoBill({
    paymentId,
    serialNumber: 7,
    currency: "CZK",
    content: paymentContent,
  })

/** The keypad rate's recap of a keypad payment's goods. */
const keypadRecap = (
  paymentContent: QerkoPaymentContent,
  taxRateId: TaxRateId | null = standardRateId
): ReadonlyArray<TaxRecapRow> =>
  calculateQerkoKeypadTaxRecap({
    goodsAmount: paymentContent.goodsAmount,
    taxRateId,
    taxRates,
  })

const receipt = (
  paymentContent: QerkoPaymentContent,
  taxRecap: ReadonlyArray<TaxRecapRow> | null = calculateTaxRecap(
    paymentContent.lines,
    taxRates
  )
): QerkoReceipt =>
  createQerkoReceipt({
    serialNumber: 7,
    currency: "CZK",
    content: paymentContent,
    taxRecap,
  })

const minorUnits = (value: string): number =>
  signedDecimalAmountToMinorUnits({ currency: "CZK", value }) ?? Number.NaN

/**
 * A bill's item is priced at its line's total, the quantity already in it,
 * as Qerko expects and `checkQerkoPaymentStart` adds it.
 */
const billTotal = (paymentBill: QerkoBill): number =>
  paymentBill.items.reduce((sum, item) => sum + minorUnits(item.price), 0)

/** A receipt's item is priced at its line's total, as Qerko's own are. */
const receiptItemsTotal = (paymentReceipt: QerkoReceipt): number =>
  paymentReceipt.items.reduce((sum, item) => sum + minorUnits(item.price), 0)

/**
 * Qerko checks neither a receipt's items nor its VAT lines against the
 * payment, and does not cancel a payment whose receipt does not add up: it
 * renders them for the customer as they come, which would hand the customer
 * a receipt that makes no sense. These tests are what keep the items adding
 * up to what the customer paid and the VAT lines to the goods.
 */
const taxTotal = (paymentReceipt: QerkoReceipt): number =>
  paymentReceipt.taxInfo.reduce(
    (sum, row) => sum + minorUnits(row.base) + minorUnits(row.tax),
    0
  )

const lineId = (paymentLine: QerkoLine): string =>
  createPaymentLineId({
    paymentId,
    catalogItemId: paymentLine.catalogItemId,
    itemId: paymentLine.itemId,
    type: paymentLine.type,
  })

describe("createQerkoBill", () => {
  test("a keypad payment is one line, paid at once", () => {
    const keypad = content(12_950, [])

    expect(keypad.kind).toBe("keypad")
    expect(bill(keypad)).toEqual({
      id: paymentId,
      name: "#7",
      currency: "CZK",
      items: [
        {
          id: paymentId,
          name: "Platba #7",
          price: "129.5",
          quantity: "1",
          minQuantity: "0",
        },
      ],
      allowPartialPayment: false,
      allowTip: true,
      denyDiscounts: true,
      denyMenus: true,
    })
  })

  test("lists the lines of a bill its payment covers", () => {
    const covered = content(17_700, [beer, soup])

    expect(covered.kind).toBe("wholeBill")
    expect(bill(covered)).toMatchObject({
      id: paymentId,
      name: "#7",
      items: [
        {
          id: lineId(beer),
          name: "Beer",
          price: "121",
          quantity: "2",
          minQuantity: "0",
        },
        {
          id: lineId(soup),
          name: "Soup",
          price: "56",
          quantity: "1",
          minQuantity: "0",
        },
      ],
      allowPartialPayment: false,
      denyDiscounts: true,
      denyMenus: true,
    })
  })

  test("lets the customer tip in Qerko and offers only the goods, never the payment's tip", () => {
    const keypad = bill(content(13_950, [], 1_000))
    const covered = bill(content(18_700, [beer, soup], 1_000))

    expect(keypad.allowTip).toBe(true)
    expect(keypad.items).toMatchObject([{ name: "Platba #7", price: "129.5" }])
    expect(covered.allowTip).toBe(true)
    expect(covered.items).toMatchObject([
      { name: "Beer", price: "121" },
      { name: "Soup", price: "56" },
    ])
  })

  test("a payment covering part of its bill stays one line", () => {
    const part = content(10_000, [beer, soup])

    expect(part.kind).toBe("partBill")
    expect(bill(part).items).toEqual([
      {
        id: paymentId,
        name: "Platba #7",
        price: "100",
        quantity: "1",
        minQuantity: "0",
      },
    ])
  })

  test("a discount goes as a line below zero", () => {
    expect(bill(content(15_930, discountedLines)).items).toMatchObject([
      { name: "Beer", price: "121", quantity: "2" },
      { name: "Soup", price: "56", quantity: "1" },
      { name: "Discount", price: "-17.7", quantity: "1" },
    ])
  })

  test("a line whose quantity is not whole goes as one at its total", () => {
    const lines = [
      line("Sýr", 700, { quantity: 0.35 }),
      line("Ham", 1_400, { quantity: 0.7 }),
      // A whole quantity goes as it is, its total however it divides.
      line("Cake", 1_000, { quantity: 3 }),
    ]

    expect(bill(content(3_100, lines)).items).toMatchObject([
      { name: "Sýr (0,35)", price: "7", quantity: "1" },
      { name: "Ham (0,7)", price: "14", quantity: "1" },
      { name: "Cake", price: "10", quantity: "3" },
    ])
  })

  test.each([
    ["a keypad payment", content(12_950, [])],
    ["a keypad payment with a tip", content(13_950, [], 1_000)],
    ["a covered bill with a tip", content(18_700, [beer, soup], 1_000)],
    ["a covered bill with a discount", content(15_930, discountedLines)],
    [
      "a covered bill of quantities not whole",
      content(3_100, [
        line("Sýr", 700, { quantity: 0.35 }),
        line("Ham", 1_400, { quantity: 0.7 }),
        line("Cake", 1_000, { quantity: 3 }),
      ]),
    ],
    ["part of a bill", content(10_000, discountedLines, 500)],
    ["more than a bill", content(20_000, discountedLines)],
  ])("its lines add up to the payment's goods", (_case, paymentContent) => {
    expect(billTotal(bill(paymentContent))).toBe(paymentContent.goodsAmount)
  })
})

describe("checkQerkoPaymentStart", () => {
  const start = (
    items: QerkoWirePayment["items"]
  ): Pick<QerkoWirePayment, "currency" | "items" | "discount"> => ({
    currency: "CZK",
    items,
    discount: null,
  })

  test("compares the items with the payment's goods, the customer's tip in none of them", () => {
    // A payment of 187 of which 10 is the tip set on Payky's screen.
    const goodsAmount = content(18_700, [beer, soup], 1_000).goodsAmount

    expect(
      checkQerkoPaymentStart({
        wire: start([
          { name: "Beer", price: "121", quantity: "2" },
          { name: "Soup", price: "56.00", quantity: "1" },
        ]),
        goodsAmount,
        currency: "CZK",
      })
    ).toBeNull()
    expect(
      checkQerkoPaymentStart({
        wire: start([{ name: "Platba #7", price: "187", quantity: "1" }]),
        goodsAmount,
        currency: "CZK",
      })
    ).toBe("amount")
  })
})

describe("readQerkoTip", () => {
  test.each([
    [{ tipBrutto: "15", tipNetto: "14.25" }, 1_500, 1_425],
    [{ tipBrutto: "15.0000", tipNetto: "14.2500" }, 1_500, 1_425],
    [{ tipBrutto: "0", tipNetto: "0" }, 0, 0],
    [{}, 0, 0],
    [{ tipBrutto: "-5", tipNetto: "0.001" }, null, null],
  ] satisfies ReadonlyArray<
    readonly [
      Pick<QerkoWirePayment, "tipBrutto" | "tipNetto">,
      number | null,
      number | null,
    ]
  >)("reads %j as %s and %s", (wire, tipAmount, tipNetAmount) => {
    expect(readQerkoTip(wire, "CZK")).toEqual({ tipAmount, tipNetAmount })
  })
})

describe("deriveQerkoChargedTip", () => {
  test.each([
    ["the goods and a tip", 11_500, 1_500, 1_500],
    ["the goods alone", 10_000, 0, 0],
    ["more than the goods and the tip", 12_000, 1_500, undefined],
    ["less than the goods", 9_000, 0, undefined],
    ["a tip Qerko gave no amount for", 11_500, null, undefined],
  ] satisfies ReadonlyArray<
    readonly [string, number, number | null, number | undefined]
  >)(
    "money that is %s takes the tip %s, %s",
    (_case, chargedAmount, tipAmount, chargedTip) => {
      expect(
        deriveQerkoChargedTip({
          chargedAmount,
          tipAmount: tipAmount === null ? null : NonNegativeInteger(tipAmount),
          goodsAmount: 10_000,
        })
      ).toBe(chargedTip)
    }
  )
})

describe("createQerkoReceipt", () => {
  test("uses the bill's VAT lines when they cover the payment", () => {
    const covered = content(22_100, [
      line("Beer", 12_100, { taxRateId: standardRateId }),
      line("Wine", 10_000, { taxRateId: reducedRateId }),
    ])

    const paymentReceipt = receipt(covered)

    expect(paymentReceipt.items).toEqual([
      { name: "Beer", quantity: "1", price: "121" },
      { name: "Wine", quantity: "1", price: "100" },
    ])
    expect(paymentReceipt.taxInfo).toEqual([
      { rate: "21", base: "100", tax: "21" },
      { rate: "12", base: "89.29", tax: "10.71" },
    ])
    expect(taxTotal(paymentReceipt)).toBe(22_100)
  })

  test("lists a covered bill's lines at their totals, no tip among them", () => {
    const paymentReceipt = receipt(content(15_930, discountedLines))

    expect(paymentReceipt.items).toEqual([
      { name: "Beer", quantity: "2", price: "121" },
      { name: "Soup", quantity: "1", price: "56" },
      { name: "Discount", quantity: "1", price: "-17.7" },
    ])
    expect(paymentReceipt.taxInfo).toEqual([
      { rate: "21", base: "90", tax: "18.9" },
      { rate: "12", base: "45", tax: "5.4" },
    ])
  })

  test("leaves the payment's own tip off the receipt", () => {
    // 10 of the tip screen's tip never reached Qerko.
    const covered = receipt(content(16_930, discountedLines, 1_000))
    const keypad = receipt(content(13_950, [], 1_000), null)

    expect(covered.items.map((item) => [item.name, item.price])).toEqual([
      ["Beer", "121"],
      ["Soup", "56"],
      ["Discount", "-17.7"],
    ])
    expect(taxTotal(covered)).toBe(15_930)
    expect(keypad).toEqual({
      items: [{ name: "Platba #7", quantity: "1", price: "129.5" }],
      taxInfo: [{ rate: "0", base: "129.5", tax: "0" }],
    })
  })

  test("prorates the bill's VAT to a payment covering part of it", () => {
    // 100 of the bill's 159.30, and a 5 tip that never reached Qerko: 68.36
    // of the beer's rate and 31.64 of the soup's, each split again at its
    // rate.
    const paymentReceipt = receipt(content(10_500, discountedLines, 500))

    expect(paymentReceipt.items).toEqual([
      { name: "Platba #7", quantity: "1", price: "100" },
    ])
    expect(paymentReceipt.taxInfo).toEqual([
      { rate: "21", base: "56.5", tax: "11.86" },
      { rate: "12", base: "28.25", tax: "3.39" },
    ])
    expect(taxTotal(paymentReceipt)).toBe(10_000)
  })

  test("taxes a VAT payer's keypad payment at the rate set for keypad amounts", () => {
    const keypad = content(12_600, [], 500)

    const paymentReceipt = receipt(keypad, keypadRecap(keypad))

    expect(paymentReceipt).toEqual({
      items: [{ name: "Platba #7", quantity: "1", price: "121" }],
      taxInfo: [{ rate: "21", base: "100", tax: "21" }],
    })
  })

  test.each([
    ["no rate is set", null],
    ["the rate set is not on this device", unknownRateId],
  ] satisfies ReadonlyArray<readonly [string, TaxRateId | null]>)(
    "a VAT payer's keypad payment carries no VAT lines when %s",
    (_case, taxRateId) => {
      const keypad = content(12_100, [])

      expect(receipt(keypad, keypadRecap(keypad, taxRateId))).toEqual({
        items: [{ name: "Platba #7", quantity: "1", price: "121" }],
        taxInfo: [],
      })
    }
  )

  test("one 0 % line holds the lines without a rate or at 0 %, not the payment's tip", () => {
    const paymentReceipt = receipt(
      content(
        16_600,
        [
          line("Beer", 12_100, { taxRateId: standardRateId }),
          line("Corkage", 1_000, { type: "manualAmount" }),
          line("Water", 2_000, { taxRateId: zeroRateId }),
          line("Tip", 500, { type: "tip" }),
        ],
        1_000
      )
    )

    expect(paymentReceipt.taxInfo).toEqual([
      { rate: "21", base: "100", tax: "21" },
      { rate: "0", base: "35", tax: "0" },
    ])
    expect(taxTotal(paymentReceipt)).toBe(15_600)
  })

  test("carries no VAT lines when the recap misses a line", () => {
    // A rate that has not synced to this device yet.
    const unsynced = content(22_100, [
      line("Beer", 12_100, { taxRateId: standardRateId }),
      line("Wine", 10_000, { taxRateId: unknownRateId }),
    ])
    expect(receipt(unsynced)).toEqual({
      items: [
        { name: "Beer", quantity: "1", price: "121" },
        { name: "Wine", quantity: "1", price: "100" },
      ],
      taxInfo: [],
    })

    // A discount frozen without shares, by an app that knew none.
    const unshared = content(15_930, [beer, soup, line("Discount", -1_770)])
    expect(receipt(unshared).taxInfo).toEqual([])

    // A payment of a bill that froze no lines, made by an older version.
    expect(receipt(content(15_930, [])).taxInfo).toEqual([])
  })

  test("a business that is not a VAT payer has one 0 % line", () => {
    const paymentReceipt = receipt(
      content(16_930, discountedLines, 1_000),
      null
    )

    expect(paymentReceipt.items).toHaveLength(3)
    expect(paymentReceipt.taxInfo).toEqual([
      { rate: "0", base: "159.3", tax: "0" },
    ])
  })

  test("leaves out of the VAT lines what a payment above its bill pays over it", () => {
    const paymentReceipt = receipt(content(20_000, discountedLines))

    expect(paymentReceipt.items).toEqual([
      { name: "Platba #7", quantity: "1", price: "200" },
    ])
    expect(paymentReceipt.taxInfo).toEqual([
      { rate: "21", base: "90", tax: "18.9" },
      { rate: "12", base: "45", tax: "5.4" },
    ])
  })

  const keypadContent = content(12_950, [], 500)

  test.each([
    ["a keypad payment", keypadContent, keypadRecap(keypadContent)],
    [
      "a keypad payment of a business that is not a VAT payer",
      keypadContent,
      null,
    ],
    [
      "a covered bill with a discount and a tip",
      content(16_930, discountedLines, 1_000),
      undefined,
    ],
    [
      "a covered bill with lines without a rate",
      content(
        16_600,
        [
          line("Beer", 12_100, { taxRateId: standardRateId }),
          line("Corkage", 1_000, { type: "manualAmount" }),
          line("Tip", 500, { type: "tip" }),
          line("Water", 2_000, { taxRateId: zeroRateId }),
        ],
        1_000
      ),
      undefined,
    ],
    ["part of a bill", content(10_500, discountedLines, 500), undefined],
    ["part of a bill, one unit", content(1, discountedLines), undefined],
    [
      "a business that is not a VAT payer",
      content(16_930, discountedLines, 1_000),
      null,
    ],
  ] satisfies ReadonlyArray<
    readonly [
      string,
      QerkoPaymentContent,
      ReadonlyArray<TaxRecapRow> | null | undefined,
    ]
  >)(
    "its items and its VAT lines add up to the goods",
    (_case, paymentContent, taxRecap) => {
      const paymentReceipt = receipt(paymentContent, taxRecap)

      expect(receiptItemsTotal(paymentReceipt)).toBe(paymentContent.goodsAmount)
      expect(paymentReceipt.taxInfo).not.toEqual([])
      expect(taxTotal(paymentReceipt)).toBe(paymentContent.goodsAmount)
      for (const row of paymentReceipt.taxInfo) {
        expect(minorUnits(row.base)).toBeGreaterThanOrEqual(0)
        expect(minorUnits(row.tax)).toBeGreaterThanOrEqual(0)
      }
    }
  )
})

describe("orderQerkoLines", () => {
  test("goods in the bill's order, then discounts, then tips", () => {
    const cartTip = line("Tip", 500, { type: "tip" })
    const discount = line("Discount", -1_770)
    const corkage = line("Corkage", 1_000, { type: "manualAmount" })
    // On the payment, but no longer in the bill's ledger.
    const gone = line("Gone", 300)

    const ordered = orderQerkoLines(
      [cartTip, gone, discount, corkage, soup, beer],
      // A line's first appearance counts, not a later add or removal.
      [soup, beer, cartTip, soup, discount, corkage, beer]
    )

    expect(ordered.map((orderedLine) => orderedLine.name)).toEqual([
      "Soup",
      "Beer",
      "Corkage",
      "Gone",
      "Discount",
      "Tip",
    ])
  })
})

describe("Qerko payment states", () => {
  test.each([
    ["STARTED", "ongoing"],
    ["PROCESSING", "ongoing"],
    ["AUTHORIZED", "ongoing"],
    ["PAID", "paid"],
    ["CANCELLED", "failed"],
    ["ERROR", "failed"],
    ["ANYTHING_ELSE", "failed"],
  ])("%s is %s", (state, outcome) => {
    expect(classifyQerkoPaymentState(state)).toBe(outcome)
  })

  test("an attempt reads from its write-once columns", () => {
    expect(
      deriveQerkoPaymentAttemptState({ processingAt: null, outcome: null })
    ).toBe("started")
    expect(
      deriveQerkoPaymentAttemptState({
        processingAt: TimestampMsSchema.decode(1),
        outcome: null,
      })
    ).toBe("processing")
    expect(
      deriveQerkoPaymentAttemptState({ processingAt: null, outcome: "paid" })
    ).toBe("paid")
  })
})
