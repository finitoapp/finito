import type { BillEditOutcome } from "@payky/core/modules/bill/bill-overpayment-guards"
import type { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import type { TranslationKey } from "./i18n/resources.ts"
import type { createTranslate } from "./i18n/translate.ts"

type Translate = ReturnType<typeof createTranslate>

export type BillChange = "edit" | "split"

type GuestPaidRemoval = Extract<BillEditOutcome, { type: "removesGuestPaid" }>

type BillCoveringOutcome = Exclude<BillEditOutcome, GuestPaidRemoval>

export interface BillEditQuestion {
  readonly title: string
  readonly description: string
}

interface QuestionText {
  readonly t: Translate
  readonly format: (value: NonNegativeInteger) => string
  readonly formatList: (items: ReadonlyArray<string>) => string
}

const guestPaidTitleKeys = {
  edit: "bill.guestPaid.remove.title",
  split: "bill.guestPaid.split.title",
} satisfies Record<BillChange, TranslationKey>

export const billEditQuestion = (
  edit: BillEditOutcome,
  change: BillChange,
  text: QuestionText
): {
  readonly outcome: BillCoveringOutcome
  readonly question: BillEditQuestion | null
} => {
  const outcome = edit.type === "removesGuestPaid" ? edit.after : edit
  if (change === "split" && outcome.type === "overpaid") {
    return { outcome, question: null }
  }
  return {
    outcome,
    question:
      edit.type === "removesGuestPaid"
        ? guestPaidQuestion(edit, change, text)
        : coveringQuestion(outcome, change, text),
  }
}

const coveringTitle = (
  outcome: BillCoveringOutcome,
  { t, format }: QuestionText
): string | null => {
  if (outcome.type === "paid") {
    return t("bill.cover.paid.title")
  }
  if (outcome.type === "overpaid") {
    return t("bill.cover.overpaid.title", {
      amount: format(outcome.unresolved),
    })
  }
  return null
}

const coveringQuestion = (
  outcome: BillCoveringOutcome,
  change: BillChange,
  text: QuestionText
): BillEditQuestion | null => {
  const title = coveringTitle(outcome, text)
  if (title === null) {
    return null
  }
  return {
    title,
    description:
      change === "split"
        ? text.t("bill.cover.split.description")
        : outcome.type === "paid"
          ? text.t("bill.cover.paid.description")
          : text.t("bill.cover.overpaid.description"),
  }
}

const guestPaidQuestion = (
  edit: GuestPaidRemoval,
  change: BillChange,
  text: QuestionText
): BillEditQuestion => {
  const names = text.formatList(edit.lineNames)
  return {
    title:
      coveringTitle(edit.after, text) ??
      text.t(guestPaidTitleKeys[change], { names }),
    description: text.t("bill.guestPaid.description", {
      amount: text.format(edit.guestPaid),
      names,
    }),
  }
}
