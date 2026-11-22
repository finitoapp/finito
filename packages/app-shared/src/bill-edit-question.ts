import type { GuestPaidRemoval } from "@payky/core/modules/bill/bill-overpayment-guards"
import type { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import type { TranslationKey } from "./i18n/resources.ts"
import type { createTranslate } from "./i18n/translate.ts"

type Translate = ReturnType<typeof createTranslate>

export type BillChange = "edit" | "split"

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

export const guestPaidQuestion = (
  removal: GuestPaidRemoval,
  change: BillChange,
  text: QuestionText
): BillEditQuestion => {
  const names = text.formatList(removal.lineNames)
  return {
    title: text.t(guestPaidTitleKeys[change], { names }),
    description: text.t("bill.guestPaid.description", {
      amount: text.format(removal.guestPaid),
      names,
    }),
  }
}
