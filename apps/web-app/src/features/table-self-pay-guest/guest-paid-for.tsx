import type { SelfPayViewBill } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import type { GuestPaymentChoice } from "./guest-checkout.tsx"
import { formatGuestAmount } from "./guest-format.ts"
import { type GuestPaidLine, guestPaidLines } from "./guest-share-choice.ts"
import {
  type GuestTranslate,
  useGuestTranslation,
} from "./use-guest-translation.ts"

const paidLineLabel = (
  { name, units, part }: GuestPaidLine,
  t: GuestTranslate
): string =>
  part !== null
    ? t("selfPay.paidFor.part", { name, ...part })
    : units > 1
      ? t("selfPay.line.quantity", { quantity: units, name })
      : name

export function GuestPaidFor({
  bill,
  choice,
}: {
  readonly bill: SelfPayViewBill
  readonly choice: GuestPaymentChoice
}) {
  const { t, locale } = useGuestTranslation()
  const { split, share, tip } = choice
  const lines = guestPaidLines(bill, split, share)
  const rows = [
    ...(split.kind === "fractionOfBill"
      ? [
          {
            key: "share",
            label: t("selfPay.paidFor.equal", { people: split.denominator }),
            amount: share.amount,
          },
        ]
      : lines.length === 0
        ? [
            {
              key: "share",
              label: t(
                split.kind === "remainder"
                  ? "selfPay.choice.remainder"
                  : "selfPay.choice.amount.label"
              ),
              amount: share.amount,
            },
          ]
        : lines.map((line) => ({
            key: line.key,
            label: paidLineLabel(line, t),
            amount: line.amount,
          }))),
    ...(tip > 0
      ? [{ key: "tip", label: t("selfPay.tip.label"), amount: tip }]
      : []),
  ]

  return (
    <section
      aria-labelledby="guest-paid-for-title"
      className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10"
    >
      <h3 id="guest-paid-for-title" className="text-sm text-muted-foreground">
        {t("selfPay.paidFor.title")}
      </h3>
      <ul className="flex flex-col divide-y divide-foreground/10">
        {rows.map(({ key, label, amount }) => (
          <li
            key={key}
            className="flex items-baseline justify-between gap-3 py-1.5"
          >
            <span className="min-w-0 truncate">{label}</span>
            <span className="shrink-0 tabular-nums">
              {formatGuestAmount(amount, bill, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
