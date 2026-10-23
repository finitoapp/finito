import type {
  SelfPayViewBill,
  SelfPayViewLine,
} from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { formatGuestAmount } from "./guest-format.ts"
import {
  type GuestTranslate,
  useGuestTranslation,
} from "./use-guest-translation.ts"

const linePaidText = (
  line: SelfPayViewLine,
  bill: SelfPayViewBill,
  t: GuestTranslate,
  locale: string
): string | null => {
  if (line.allocatedAmount === 0) return null
  if (line.allocatedAmount >= line.totalAmount)
    return t("selfPay.line.fullyPaid")
  return t("selfPay.line.paid", {
    paid: formatGuestAmount(line.allocatedAmount, bill, locale),
    total: formatGuestAmount(line.totalAmount, bill, locale),
  })
}

export function GuestBillSummary({ bill }: { readonly bill: SelfPayViewBill }) {
  const { t, locale } = useGuestTranslation()
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <ul className="flex flex-col divide-y divide-foreground/10">
        {bill.lines.map((line) => {
          const paid = linePaidText(line, bill, t, locale)
          const paidRatio = Math.min(
            1,
            line.allocatedAmount / Math.max(1, line.totalAmount)
          )
          return (
            <li key={line.key} className="flex flex-col gap-1 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {line.quantity === 1
                    ? line.name
                    : t("selfPay.line.quantity", {
                        quantity: line.quantity,
                        name: line.name,
                      })}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatGuestAmount(line.totalAmount, bill, locale)}
                </span>
              </div>
              {paid === null ? null : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="h-1 w-16 overflow-hidden rounded-full bg-foreground/10"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full bg-primary"
                      style={{ width: `${paidRatio * 100}%` }}
                    />
                  </span>
                  <span>{paid}</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("selfPay.bill.total")}</dt>
        <dd className="text-right tabular-nums">
          {formatGuestAmount(bill.total, bill, locale)}
        </dd>
        <dt className="text-muted-foreground">{t("selfPay.bill.paid")}</dt>
        <dd className="text-right tabular-nums">
          {formatGuestAmount(bill.covered, bill, locale)}
        </dd>
        <dt className="font-medium">{t("selfPay.bill.remainder")}</dt>
        <dd className="text-right text-lg font-semibold tabular-nums">
          {formatGuestAmount(bill.remainder, bill, locale)}
        </dd>
      </dl>
    </section>
  )
}
