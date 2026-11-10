import {
  calculateChosenSelfPayShare,
  remainingOnLine,
  type SelfPayLineFraction,
  type SelfPayShare,
  type SelfPaySplit,
} from "@payky/core/modules/table-self-pay/table-self-pay-share-utils"
import type { SelfPayViewLine } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"

export const MIN_PEOPLE = 2
export const MAX_PEOPLE_ON_BILL = 20
export const MAX_PEOPLE_ON_LINE = 10

export interface GuestLinePick {
  readonly units: number
  readonly people: number | null
}

export const unitsOfLine = (line: SelfPayViewLine): number =>
  Number.isInteger(line.quantity) && line.quantity >= 1 ? line.quantity : 1

export const unpaidUnits = (line: SelfPayViewLine): number =>
  line.totalAmount === 0
    ? 0
    : Math.ceil((remainingOnLine(line) * unitsOfLine(line)) / line.totalAmount)

const pickedFraction = (
  line: SelfPayViewLine,
  { units, people }: GuestLinePick
): Omit<SelfPayLineFraction, "key"> | null => {
  if (people !== null) return { numerator: 1, denominator: people }
  if (units <= 0) return null
  if (units >= unpaidUnits(line)) return { numerator: 1, denominator: 1 }
  return { numerator: units, denominator: unitsOfLine(line) }
}

export const pickedLinesSplit = (
  lines: ReadonlyArray<SelfPayViewLine>,
  picks: Readonly<Record<string, GuestLinePick>>
): SelfPaySplit => ({
  kind: "lines",
  fractions: lines.flatMap((line) => {
    const pick = picks[line.key]
    const fraction = pick === undefined ? null : pickedFraction(line, pick)
    return fraction === null ? [] : [{ key: line.key, ...fraction }]
  }),
})

export interface GuestPaidLine {
  readonly key: string
  readonly name: string
  readonly units: number
  readonly part: Omit<SelfPayLineFraction, "key"> | null
  readonly amount: number
}

export const guestPaidLines = (
  bill: {
    readonly remainder: number
    readonly lines: ReadonlyArray<SelfPayViewLine>
  },
  split: SelfPaySplit,
  share: SelfPayShare
): ReadonlyArray<GuestPaidLine> => {
  const fractions =
    split.kind === "lines" &&
    share.amount === calculateChosenSelfPayShare(bill, split).amount
      ? split.fractions
      : []
  return share.lines.flatMap(
    ({ key, amount }): ReadonlyArray<GuestPaidLine> => {
      const line = bill.lines.find((candidate) => candidate.key === key)
      if (line === undefined) return []
      const fraction = fractions.find((candidate) => candidate.key === key)
      const paid = { key, name: line.name, amount }
      if (fraction === undefined || fraction.numerator === fraction.denominator)
        return [{ ...paid, units: unpaidUnits(line), part: null }]
      if (fraction.denominator === unitsOfLine(line))
        return [{ ...paid, units: fraction.numerator, part: null }]
      const { numerator, denominator } = fraction
      return [{ ...paid, units: 1, part: { numerator, denominator } }]
    }
  )
}

export type GuestTip =
  | { readonly kind: "percent"; readonly percent: number }
  | { readonly kind: "amount"; readonly amount: number }

export const guestTipAmount = (share: number, tip: GuestTip): number =>
  tip.kind === "amount" ? tip.amount : Math.round((share * tip.percent) / 100)

export const parsePercent = (text: string): number | null => {
  const trimmed = text.trim()
  return /^\d{1,3}(?:[.,]\d+)?$/u.test(trimmed)
    ? Number(trimmed.replace(",", "."))
    : null
}
