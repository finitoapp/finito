import type { z } from "zod"

import type { FiatCurrency } from "../shared/schema.ts"
import type { SelfPayShareBillSchema } from "./table-self-pay-view-utils.ts"

export interface SelfPayLineFraction {
  readonly key: string
  readonly numerator: number
  readonly denominator: number
}

export type SelfPaySplit =
  | { readonly kind: "remainder" }
  | { readonly kind: "amount"; readonly amount: number }
  | {
      readonly kind: "lines"
      readonly fractions: ReadonlyArray<SelfPayLineFraction>
    }
  | { readonly kind: "fractionOfBill"; readonly denominator: number }

export interface SelfPayShare {
  readonly amount: number
  readonly lines: ReadonlyArray<{
    readonly key: string
    readonly amount: number
  }>
}

export type SelfPayShareBill = z.output<typeof SelfPayShareBillSchema>

type SelfPayShareLine = SelfPayShareBill["lines"][number]

const capToLine = (
  roundedShare: number,
  remaining: number,
  denominator: number
): number => {
  const share = Math.max(0, Math.min(remaining, roundedShare))
  const leftover = remaining - share

  return leftover > 0 && leftover < denominator ? remaining : share
}

export const calculateSelfPayLineShare = ({
  lineTotal,
  remaining,
  numerator,
  denominator,
}: {
  readonly lineTotal: number
  readonly remaining: number
  readonly numerator: number
  readonly denominator: number
}): number =>
  capToLine(
    Math.floor((lineTotal * numerator) / denominator),
    remaining,
    denominator
  )

const selfPayMinimums = {
  CZK: 100,
  EUR: 5,
  USD: 5,
} satisfies Record<FiatCurrency, number>

export const selfPayMinimum = (currency: FiatCurrency): number =>
  selfPayMinimums[currency]

export const meetsSelfPayMinimum = ({
  amount,
  remainder,
  currency,
}: {
  readonly amount: number
  readonly remainder: number
  readonly currency: FiatCurrency
}): boolean =>
  amount >= selfPayMinimum(currency) || (remainder > 0 && amount >= remainder)

export const remainingOnLine = (line: SelfPayShareLine): number =>
  Math.max(0, line.totalAmount - line.allocatedAmount)

const sumAmounts = (lines: SelfPayShare["lines"]) =>
  lines.reduce((sum, { amount }) => sum + amount, 0)

interface FractionOfLine {
  readonly line: SelfPayShareLine
  readonly numerator: number
  readonly denominator: number
}

const greatestCommonDivisor = (a: bigint, b: bigint): bigint =>
  b === 0n ? a : greatestCommonDivisor(b, a % b)

const shareOfLines = (
  fractions: ReadonlyArray<FractionOfLine>
): SelfPayShare => {
  const exact = fractions
    .filter(({ line }) => remainingOnLine(line) > 0)
    .map(({ line, numerator, denominator }, position) => ({
      line,
      position,
      floor: Math.floor((line.totalAmount * numerator) / denominator),
      remainder: (line.totalAmount * numerator) % denominator,
      denominator,
    }))
  const commonDenominator = exact.reduce((multiple, { denominator }) => {
    const next = BigInt(denominator)
    return (multiple / greatestCommonDivisor(multiple, next)) * next
  }, 1n)
  const missing = Number(
    exact.reduce(
      (sum, { remainder, denominator }) =>
        sum + BigInt(remainder) * (commonDenominator / BigInt(denominator)),
      0n
    ) / commonDenominator
  )
  const toppedUp = new Set(
    exact
      .toSorted(
        (a, b) =>
          b.remainder * a.denominator - a.remainder * b.denominator ||
          a.position - b.position
      )
      .slice(0, missing)
      .map(({ position }) => position)
  )
  const lines = exact.flatMap(({ line, position, floor, denominator }) => {
    const amount = capToLine(
      floor + (toppedUp.has(position) ? 1 : 0),
      remainingOnLine(line),
      denominator
    )
    return amount > 0 ? [{ key: line.key, amount }] : []
  })
  return { amount: sumAmounts(lines), lines }
}

export const calculateChosenSelfPayShare = (
  bill: SelfPayShareBill,
  split: SelfPaySplit
): SelfPayShare => {
  switch (split.kind) {
    case "remainder": {
      const lines = bill.lines.flatMap((line) => {
        const amount = remainingOnLine(line)
        return amount > 0 ? [{ key: line.key, amount }] : []
      })
      return {
        amount: bill.remainder,
        lines: sumAmounts(lines) === bill.remainder ? lines : [],
      }
    }
    case "amount":
      return { amount: Math.max(0, Math.round(split.amount)), lines: [] }
    case "lines":
      return shareOfLines(
        split.fractions.flatMap(({ key, numerator, denominator }) => {
          const line = bill.lines.find((candidate) => candidate.key === key)
          return line === undefined ? [] : [{ line, numerator, denominator }]
        })
      )
    case "fractionOfBill":
      if (bill.lines.length === 0) {
        return {
          amount: calculateSelfPayLineShare({
            lineTotal: bill.remainder,
            remaining: bill.remainder,
            numerator: 1,
            denominator: split.denominator,
          }),
          lines: [],
        }
      }
      return shareOfLines(
        bill.lines.map((line) => ({
          line,
          numerator: 1,
          denominator: split.denominator,
        }))
      )
  }
}

export const calculateSelfPayShare = (
  bill: SelfPayShareBill,
  split: SelfPaySplit,
  currency: FiatCurrency
): SelfPayShare => {
  const chosen = calculateChosenSelfPayShare(bill, split)
  const rest = bill.remainder - chosen.amount
  const leavesTooLittle = rest > 0 && rest < selfPayMinimum(currency)
  const typesMoreThanOwed = split.kind === "amount" && rest < 0
  return chosen.amount > 0 && (leavesTooLittle || typesMoreThanOwed)
    ? calculateChosenSelfPayShare(bill, { kind: "remainder" })
    : chosen
}
