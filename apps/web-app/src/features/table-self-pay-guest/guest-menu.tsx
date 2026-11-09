import {
  MAX_ORDER_NOTE_LENGTH,
  MAX_ORDER_QUANTITY,
  priceSelfPayOrder,
  type SelfPayMenu,
  type SelfPayOrderSelection,
} from "@payky/core/modules/menu-order/menu-order-utils"
import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { Label } from "@/components/ui/label.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import { Stepper, usePayBarScrollPadding } from "./guest-checkout.tsx"
import { formatGuestAmount } from "./guest-format.ts"
import { guestTipAmount } from "./guest-share-choice.ts"
import { useGuestStatus } from "./guest-status.tsx"
import {
  type GuestTipChoice,
  GuestTipPicker,
  isCustomTipUnreadable,
  NO_TIP,
  resolveGuestTip,
} from "./guest-tip-picker.tsx"
import { useGuestTranslation } from "./use-guest-translation.ts"

export interface GuestOrderChoice {
  readonly items: SelfPayOrderSelection["items"]
  readonly note: string | null
  readonly total: number
  readonly amount: number
  readonly summary: string
}

interface GuestMenuPick {
  readonly name: string
  readonly quantity: number
}

export function GuestMenu({
  menu,
  hidden,
  isPreparing,
  notice,
  onOrder,
}: {
  readonly menu: SelfPayMenu
  readonly hidden: boolean
  readonly isPreparing: boolean
  readonly notice: ReactNode
  readonly onOrder: (order: GuestOrderChoice) => void
}) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const [picks, setPicks] = useState<Readonly<Record<string, GuestMenuPick>>>(
    {}
  )
  const [removedNames, setRemovedNames] = useState<ReadonlyArray<string>>([])
  const [note, setNote] = useState("")
  const [tipChoice, setTipChoice] = useState<GuestTipChoice>(NO_TIP)
  const payBar = usePayBarScrollPadding()
  const format = (amount: number) => formatGuestAmount(amount, menu, locale)
  const menuItems = menu.categories.flatMap((category) => category.items)
  const isOnMenu = (key: string) => menuItems.some((item) => item.key === key)
  const removedPicks = Object.entries(picks).filter(
    ([key, { quantity }]) => quantity > 0 && !isOnMenu(key)
  )
  if (removedPicks.length > 0) {
    setPicks(
      Object.fromEntries(Object.entries(picks).filter(([key]) => isOnMenu(key)))
    )
    setRemovedNames([
      ...removedNames,
      ...removedPicks.map(([, { name }]) => name),
    ])
  }
  const picked = menuItems.flatMap(({ key }) => {
    const quantity = picks[key]?.quantity ?? 0
    return quantity === 0 ? [] : [{ key, quantity }]
  })
  const priced = priceSelfPayOrder(menu, picked)
  const lines = priced?.lines ?? []
  const total = priced?.total ?? 0
  const tipAmount = guestTipAmount(
    total,
    resolveGuestTip(tipChoice, menu.currency)
  )
  const amount = total + tipAmount
  const payLabel =
    total === 0
      ? t("selfPay.summary.nothing")
      : t("selfPay.pay.total", { amount: format(amount) })
  const announced = useRef(payLabel)
  const removedText =
    removedNames.length === 0
      ? null
      : t("selfPay.menu.removed", { names: removedNames.join(", ") })

  useEffect(() => {
    if (hidden || announced.current === payLabel) return
    announced.current = payLabel
    announce(payLabel)
  }, [announce, payLabel, hidden])

  useEffect(() => {
    if (hidden || removedText === null) return
    announce(removedText)
  }, [announce, removedText, hidden])

  const order = () => {
    const trimmedNote = note.trim()
    onOrder({
      items: picked,
      note: trimmedNote === "" ? null : trimmedNote,
      total,
      amount,
      summary: lines
        .map(({ item, quantity }) =>
          quantity === 1
            ? item.name
            : t("selfPay.line.quantity", { quantity, name: item.name })
        )
        .join(", "),
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-6" hidden={hidden}>
      {menu.categories.map((category, index) => (
        <section
          key={category.name ?? `uncategorized-${index}`}
          className="flex flex-col gap-1"
        >
          {category.name === null && menu.categories.length === 1 ? null : (
            <h2 className="font-semibold">
              {category.name ?? t("selfPay.menu.other")}
            </h2>
          )}
          <ul className="flex flex-col divide-y divide-foreground/10">
            {category.items.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{item.name}</span>
                  {item.description === null ? null : (
                    <span className="text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                  <span className="text-sm tabular-nums">
                    {format(item.unitAmount)}
                  </span>
                </div>
                <Stepper
                  value={picks[item.key]?.quantity ?? 0}
                  min={0}
                  max={MAX_ORDER_QUANTITY}
                  label={t("selfPay.menu.quantity.label", { name: item.name })}
                  decreaseLabel={t("selfPay.menu.quantity.decrease", {
                    name: item.name,
                  })}
                  increaseLabel={t("selfPay.menu.quantity.increase", {
                    name: item.name,
                  })}
                  onChange={(quantity) => {
                    setRemovedNames([])
                    setPicks((current) => ({
                      ...current,
                      [item.key]: { name: item.name, quantity },
                    }))
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {lines.length === 0 ? null : (
        <section
          aria-labelledby="guest-order-title"
          className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <h2 id="guest-order-title" className="font-semibold">
            {t("selfPay.order.title")}
          </h2>
          <ul className="flex flex-col divide-y divide-foreground/10">
            {lines.map(({ item, quantity, totalAmount }) => (
              <li
                key={item.key}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="min-w-0 truncate">
                  {t("selfPay.line.quantity", { quantity, name: item.name })}
                </span>
                <span className="shrink-0 tabular-nums">
                  {format(totalAmount)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-3 font-semibold tabular-nums">
            <span>{t("selfPay.bill.total")}</span>
            <span>{format(total)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="guest-order-note">
              {t("selfPay.order.note.label")}
            </Label>
            <Textarea
              id="guest-order-note"
              rows={2}
              maxLength={MAX_ORDER_NOTE_LENGTH}
              aria-describedby="guest-order-note-length"
              value={note}
              onChange={(event) => {
                setNote(event.currentTarget.value)
              }}
            />
            <p
              id="guest-order-note-length"
              className="text-sm text-muted-foreground tabular-nums"
            >
              {t("selfPay.order.note.length", {
                length: note.length,
                max: MAX_ORDER_NOTE_LENGTH,
              })}
            </p>
          </div>
        </section>
      )}

      <GuestTipPicker
        currency={menu.currency}
        share={total}
        choice={tipChoice}
        onChange={setTipChoice}
      />

      <footer
        ref={payBar}
        className="sticky bottom-0 z-20 -mx-4 mt-auto flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-4"
      >
        {notice}
        {removedText === null ? null : (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm">
            <TriangleAlertIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-amber-600"
            />
            {removedText}
          </p>
        )}
        <div className="flex justify-between gap-3 text-sm text-muted-foreground tabular-nums">
          <span>
            {total > 0
              ? t("selfPay.order.summary", { amount: format(total) })
              : t("selfPay.summary.nothing")}
          </span>
          {total > 0 ? (
            <span>
              {tipAmount > 0
                ? t("selfPay.summary.tip", { amount: format(tipAmount) })
                : t("selfPay.summary.noTip")}
            </span>
          ) : null}
        </div>
        {total === 0 ? null : (
          <Button
            type="button"
            size="lg"
            className="h-12 text-base"
            disabled={
              isPreparing || isCustomTipUnreadable(tipChoice, menu.currency)
            }
            onClick={order}
          >
            {isPreparing ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {isPreparing ? t("selfPay.pay.preparing") : payLabel}
          </Button>
        )}
      </footer>
    </div>
  )
}
