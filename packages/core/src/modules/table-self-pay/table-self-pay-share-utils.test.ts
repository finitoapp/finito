import { describe, expect, test } from "vitest"

import {
  createSeededRandom,
  type SeededRandom,
} from "../../testing/seeded-random.ts"

import {
  calculateSelfPayLineShare,
  calculateSelfPayShare,
  meetsSelfPayMinimum,
  remainingOnLine,
  type SelfPayShare,
  type SelfPayShareBill,
  selfPayMinimum,
} from "./table-self-pay-share-utils.ts"

const payInTurn = (
  lineTotal: number,
  numerator: number,
  denominator: number,
  payers: number
): ReadonlyArray<number> => {
  const shares: number[] = []
  let remaining = lineTotal
  for (let payer = 0; payer < payers; payer++) {
    const share = calculateSelfPayLineShare({
      lineTotal,
      remaining,
      numerator,
      denominator,
    })
    shares.push(share)
    remaining -= share
  }
  return shares
}

describe("calculateSelfPayLineShare", () => {
  test("splits 101.00 into five equal fifths", () => {
    expect(payInTurn(10_100, 1, 5, 5)).toEqual([2020, 2020, 2020, 2020, 2020])
  })

  test("gives the rounding leftover of 100.00 in thirds to the last payer", () => {
    expect(payInTurn(10_000, 1, 3, 3)).toEqual([3333, 3333, 3334])
  })

  test("rounds a third of 98.00 down and leaves the rest to the last payer", () => {
    expect(payInTurn(9800, 1, 3, 3)).toEqual([3266, 3266, 3268])
  })

  test("prices units of a quantity line as their fraction of it", () => {
    expect(
      calculateSelfPayLineShare({
        lineTotal: 13_500,
        remaining: 13_500,
        numerator: 1,
        denominator: 3,
      })
    ).toBe(4500)
  })

  test("pays the rest of the line as the whole fraction", () => {
    expect(
      calculateSelfPayLineShare({
        lineTotal: 10_100,
        remaining: 6060,
        numerator: 1,
        denominator: 1,
      })
    ).toBe(6060)
  })

  test("never asks for more than is left on the line", () => {
    expect(
      calculateSelfPayLineShare({
        lineTotal: 10_000,
        remaining: 3000,
        numerator: 1,
        denominator: 2,
      })
    ).toBe(3000)
    expect(
      calculateSelfPayLineShare({
        lineTotal: 10_000,
        remaining: -2020,
        numerator: 1,
        denominator: 5,
      })
    ).toBe(0)
  })

  test("leaves no remainder whatever the line and the fraction", () => {
    for (const lineTotal of [1, 7, 999, 10_000, 10_100, 123_457]) {
      for (const denominator of [2, 3, 4, 5, 6, 7, 9]) {
        const shares = payInTurn(lineTotal, 1, denominator, denominator)
        expect(shares.reduce((sum, share) => sum + share, 0)).toBe(lineTotal)
      }
    }
  })
})

const bill = (
  lines: ReadonlyArray<{
    readonly key: string
    readonly totalAmount: number
    readonly allocatedAmount?: number
    readonly quantity?: number
  }>,
  covered = 0
): SelfPayShareBill => ({
  remainder: Math.max(
    0,
    lines.reduce((sum, line) => sum + line.totalAmount, 0) - covered
  ),
  lines: lines.map(({ key, totalAmount, allocatedAmount, quantity }) => ({
    key,
    quantity: quantity ?? 1,
    totalAmount,
    allocatedAmount: allocatedAmount ?? 0,
  })),
})

const payAndAllocate = (
  current: SelfPayShareBill,
  share: SelfPayShare
): SelfPayShareBill => ({
  remainder: current.remainder - share.amount,
  lines: current.lines.map((line) => ({
    ...line,
    allocatedAmount:
      line.allocatedAmount +
      (share.lines.find(({ key }) => key === line.key)?.amount ?? 0),
  })),
})

describe("calculateSelfPayShare", () => {
  test("pays a fifth of a 101.00 pizza as 20.20", () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])

    expect(
      calculateSelfPayShare(
        current,
        {
          kind: "lines",
          fractions: [{ key: "PIZZAAAA", numerator: 1, denominator: 5 }],
        },
        "CZK"
      )
    ).toEqual({ amount: 2020, lines: [{ key: "PIZZAAAA", amount: 2020 }] })
  })

  test("pays thirds of 100.00 as 33.33, 33.33 and 33.34", () => {
    let current = bill([{ key: "MENUAAAA", totalAmount: 10_000 }])
    const amounts: number[] = []
    for (let guest = 0; guest < 3; guest++) {
      const share = calculateSelfPayShare(
        current,
        {
          kind: "lines",
          fractions: [{ key: "MENUAAAA", numerator: 1, denominator: 3 }],
        },
        "CZK"
      )
      amounts.push(share.amount)
      current = payAndAllocate(current, share)
    }

    expect(amounts).toEqual([3333, 3333, 3334])
    expect(current.lines[0]?.allocatedAmount).toBe(10_000)
  })

  test("pays one of three beers as its unit price", () => {
    expect(
      calculateSelfPayShare(
        bill([{ key: "BEERAAAA", totalAmount: 13_500, quantity: 3 }]),
        {
          kind: "lines",
          fractions: [{ key: "BEERAAAA", numerator: 1, denominator: 3 }],
        },
        "CZK"
      )
    ).toEqual({ amount: 4500, lines: [{ key: "BEERAAAA", amount: 4500 }] })
  })

  test("pays half of each of 5 lines of a 10-line bill", () => {
    const current = bill(
      Array.from({ length: 10 }, (_, index) => ({
        key: `LINE${index}`,
        totalAmount: 10_000,
      }))
    )
    const keys = ["LINE0", "LINE2", "LINE4", "LINE6", "LINE8"]

    expect(
      calculateSelfPayShare(
        current,
        {
          kind: "lines",
          fractions: keys.map((key) => ({ key, numerator: 1, denominator: 2 })),
        },
        "CZK"
      )
    ).toEqual({
      amount: 25_000,
      lines: keys.map((key) => ({ key, amount: 5000 })),
    })
  })

  test("asks 4.33 for a third of each line of a 5.00 and 8.00 bill, as for a third of the bill", () => {
    const current = bill([
      { key: "BREADAAA", totalAmount: 500 },
      { key: "SOUPAAAA", totalAmount: 800 },
    ])
    const third = {
      amount: 433,
      lines: [
        { key: "BREADAAA", amount: 167 },
        { key: "SOUPAAAA", amount: 266 },
      ],
    }

    expect(
      calculateSelfPayShare(
        current,
        {
          kind: "lines",
          fractions: current.lines.map(({ key }) => ({
            key,
            numerator: 1,
            denominator: 3,
          })),
        },
        "CZK"
      )
    ).toEqual(third)
    expect(
      calculateSelfPayShare(
        current,
        { kind: "fractionOfBill", denominator: 3 },
        "CZK"
      )
    ).toEqual(third)
  })

  test("asks 3.00 for a third of the bill as for a third of each open line once a line is paid", () => {
    const current = bill(
      [
        { key: "BREADAAA", totalAmount: 500, allocatedAmount: 500 },
        { key: "SOUPAAAA", totalAmount: 800 },
        { key: "WATERAAA", totalAmount: 100 },
      ],
      500
    )
    const third = {
      amount: 300,
      lines: [
        { key: "SOUPAAAA", amount: 267 },
        { key: "WATERAAA", amount: 33 },
      ],
    }

    expect(
      calculateSelfPayShare(
        current,
        {
          kind: "lines",
          fractions: [
            { key: "SOUPAAAA", numerator: 1, denominator: 3 },
            { key: "WATERAAA", numerator: 1, denominator: 3 },
          ],
        },
        "CZK"
      )
    ).toEqual(third)
    expect(
      calculateSelfPayShare(
        current,
        { kind: "fractionOfBill", denominator: 3 },
        "CZK"
      )
    ).toEqual(third)
  })

  test("leaves nothing to pay after two guests each pay half of the bill", () => {
    let current = bill([
      { key: "PIZZAAAA", totalAmount: 10_100 },
      { key: "BEERAAAA", totalAmount: 13_500, quantity: 3 },
      { key: "TEAAAAAA", totalAmount: 4999 },
    ])
    const amounts: number[] = []
    for (let guest = 0; guest < 2; guest++) {
      const share = calculateSelfPayShare(
        current,
        {
          kind: "fractionOfBill",
          denominator: 2,
        },
        "CZK"
      )
      amounts.push(share.amount)
      current = payAndAllocate(current, share)
    }

    expect(amounts).toEqual([14_299, 14_300])
    expect(current.remainder).toBe(0)
    expect(
      current.lines.map(({ totalAmount, allocatedAmount }) => [
        totalAmount,
        allocatedAmount,
      ])
    ).toEqual([
      [10_100, 10_100],
      [13_500, 13_500],
      [4999, 4999],
    ])
  })

  test("asks each of three guests for 193.00 of a 579.00 bill and settles it", () => {
    let current = bill([
      { key: "PIZZAAAA", totalAmount: 18_900 },
      { key: "BEERAAAA", totalAmount: 16_200, quantity: 3 },
      { key: "COFFEEAA", totalAmount: 9800, quantity: 2 },
      { key: "CAKEAAAA", totalAmount: 9500 },
      { key: "WATERAAA", totalAmount: 3500 },
    ])
    const amounts: number[] = []
    for (let guest = 0; guest < 3; guest++) {
      const share = calculateSelfPayShare(
        current,
        { kind: "fractionOfBill", denominator: 3 },
        "CZK"
      )
      expect(share.lines.reduce((sum, { amount }) => sum + amount, 0)).toBe(
        share.amount
      )
      amounts.push(share.amount)
      current = payAndAllocate(current, share)
    }

    expect(amounts).toEqual([19_300, 19_300, 19_300])
    expect(current.remainder).toBe(0)
    expect(
      current.lines.every(
        ({ totalAmount, allocatedAmount }) => allocatedAmount === totalAmount
      )
    ).toBe(true)
  })

  test("leaves 0.02 of a 98.00 bill when three guests pay a third at once", () => {
    const current = bill([{ key: "MENUAAAA", totalAmount: 9800 }])
    const share = calculateSelfPayShare(
      current,
      { kind: "fractionOfBill", denominator: 3 },
      "CZK"
    )

    expect(share).toEqual({
      amount: 3266,
      lines: [{ key: "MENUAAAA", amount: 3266 }],
    })
    expect(current.remainder - 3 * share.amount).toBe(2)
  })

  test("pays the whole remainder with every line's rest allocated", () => {
    const current = bill(
      [
        { key: "PIZZAAAA", totalAmount: 10_100, allocatedAmount: 2020 },
        { key: "BEERAAAA", totalAmount: 4500 },
      ],
      2020
    )

    expect(
      calculateSelfPayShare(current, { kind: "remainder" }, "CZK")
    ).toEqual({
      amount: 12_580,
      lines: [
        { key: "PIZZAAAA", amount: 8080 },
        { key: "BEERAAAA", amount: 4500 },
      ],
    })
  })

  test("pays the remainder without allocation when earlier money named no lines", () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }], 5000)

    expect(
      calculateSelfPayShare(current, { kind: "remainder" }, "CZK")
    ).toEqual({
      amount: 5100,
      lines: [],
    })
  })

  test("pays any amount without allocating it", () => {
    expect(
      calculateSelfPayShare(
        bill([{ key: "PIZZAAAA", totalAmount: 10_100 }]),
        {
          kind: "amount",
          amount: 3000,
        },
        "CZK"
      )
    ).toEqual({ amount: 3000, lines: [] })
  })

  test("a third of a bill without lines", () => {
    const byTotals = { remainder: 10_000, lines: [] }

    expect(
      calculateSelfPayShare(
        byTotals,
        {
          kind: "fractionOfBill",
          denominator: 3,
        },
        "CZK"
      )
    ).toEqual({ amount: 3333, lines: [] })
    expect(
      calculateSelfPayShare(
        { remainder: 2, lines: [] },
        { kind: "fractionOfBill", denominator: 3 },
        "CZK"
      )
    ).toEqual({ amount: 2, lines: [] })
  })

  test("an amount that would leave less than the minimum pays the whole remainder", () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 34_040 }])

    expect(
      calculateSelfPayShare(current, { kind: "amount", amount: 34_000 }, "CZK")
    ).toEqual({ amount: 34_040, lines: [{ key: "PIZZAAAA", amount: 34_040 }] })
    expect(
      calculateSelfPayShare(current, { kind: "amount", amount: 33_940 }, "CZK")
    ).toEqual({ amount: 33_940, lines: [] })
  })

  test("an amount above what the bill owes pays the whole remainder", () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 34_040 }])

    expect(
      calculateSelfPayShare(current, { kind: "amount", amount: 340_400 }, "CZK")
    ).toEqual({ amount: 34_040, lines: [{ key: "PIZZAAAA", amount: 34_040 }] })
  })

  test("items that would leave less than the minimum take the rest of the bill", () => {
    const current = bill([
      { key: "BEERAAAA", totalAmount: 4500 },
      { key: "BAGAAAAA", totalAmount: 50 },
    ])

    expect(
      calculateSelfPayShare(
        current,
        {
          kind: "lines",
          fractions: [{ key: "BEERAAAA", numerator: 1, denominator: 1 }],
        },
        "CZK"
      )
    ).toEqual({
      amount: 4550,
      lines: [
        { key: "BEERAAAA", amount: 4500 },
        { key: "BAGAAAAA", amount: 50 },
      ],
    })
  })
})

describe("the self-pay minimum", () => {
  test("is about one koruna in every currency", () => {
    expect(selfPayMinimum("CZK")).toBe(100)
    expect(selfPayMinimum("EUR")).toBe(5)
    expect(selfPayMinimum("USD")).toBe(5)
  })

  test("lets money below it count only when it covers everything left", () => {
    const meets = (amount: number, remainder: number) =>
      meetsSelfPayMinimum({ amount, remainder, currency: "CZK" })

    expect(meets(100, 34_040)).toBe(true)
    expect(meets(99, 34_040)).toBe(false)
    expect(meets(40, 40)).toBe(true)
    expect(meets(40, 30)).toBe(true)
    expect(meets(40, 50)).toBe(false)
    expect(meets(40, 0)).toBe(false)
  })
})

const randomBill = (random: SeededRandom): SelfPayShareBill =>
  bill(
    Array.from({ length: 1 + random(12) }, (_, index) => ({
      key: `LINE${index}`,
      totalAmount: 1 + random(200_000),
      quantity: 1 + random(6),
    }))
  )

const isSettled = (current: SelfPayShareBill) =>
  current.remainder === 0 &&
  current.lines.every(
    ({ totalAmount, allocatedAmount }) => allocatedAmount === totalAmount
  )

describe("splitting random bills", () => {
  test("settles the bill exactly when each of N guests pays 1/N of it", () => {
    const random = createSeededRandom(20_261_013)
    for (let run = 0; run < 2000; run++) {
      let current = randomBill(random)
      const total = current.remainder
      const guests = 2 + random(8)
      for (let guest = 0; guest < guests; guest++) {
        const share = calculateSelfPayShare(
          current,
          {
            kind: "fractionOfBill",
            denominator: guests,
          },
          "CZK"
        )
        expect(Math.abs(share.amount - total / guests)).toBeLessThanOrEqual(
          current.lines.length * guests
        )
        current = payAndAllocate(current, share)
      }

      expect(isSettled(current)).toBe(true)
    }
  })

  test("asks the same for 1/N of every line as for 1/N of the bill", () => {
    const random = createSeededRandom(20_261_018)
    for (let run = 0; run < 2000; run++) {
      const current = randomBill(random)
      const denominator = 2 + random(9)

      expect(
        calculateSelfPayShare(
          current,
          {
            kind: "lines",
            fractions: current.lines.map(({ key }) => ({
              key,
              numerator: 1,
              denominator,
            })),
          },
          "CZK"
        )
      ).toEqual(
        calculateSelfPayShare(
          current,
          { kind: "fractionOfBill", denominator },
          "CZK"
        )
      )
    }
  })

  test("never asks for more than is left, whatever guests pick, and the rest settles the bill", () => {
    const random = createSeededRandom(20_261_014)
    for (let run = 0; run < 2000; run++) {
      let current = randomBill(random)
      const guests = 1 + random(6)
      for (let guest = 0; guest < guests; guest++) {
        const share = calculateSelfPayShare(
          current,
          {
            kind: "lines",
            fractions: current.lines
              .filter(() => random(2) === 0)
              .map(({ key, quantity }) =>
                random(2) === 0
                  ? {
                      key,
                      numerator: 1 + random(quantity),
                      denominator: quantity,
                    }
                  : { key, numerator: 1, denominator: 2 + random(9) }
              ),
          },
          "CZK"
        )
        for (const { key, amount } of share.lines) {
          const line = current.lines.find((candidate) => candidate.key === key)
          expect(line && amount <= remainingOnLine(line)).toBe(true)
        }
        expect(share.amount).toBeLessThanOrEqual(current.remainder)
        const rest = current.remainder - share.amount
        expect(rest === 0 || rest >= selfPayMinimum("CZK")).toBe(true)
        current = payAndAllocate(current, share)
      }

      current = payAndAllocate(
        current,
        calculateSelfPayShare(current, { kind: "remainder" }, "CZK")
      )

      expect(isSettled(current)).toBe(true)
    }
  })
})
