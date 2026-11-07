import { csBill } from "@payky/app-shared/i18n/cs/bill"
import type { SelfPayOrderConfirmation } from "@payky/core/modules/menu-order/menu-order-utils"
import { describe, expect, test } from "vitest"
import {
  guestOrderLeft,
  guestOrderStatus,
  type ShownGuestOrder,
} from "./guest-order-list.tsx"
import type { GuestOrder } from "./guest-orders.ts"
import type { GuestTranslate } from "./use-guest-translation.ts"

const t: GuestTranslate = (key, params = {}) =>
  Object.entries(params).reduce<string>(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    csBill[key]
  )

const order = {
  currency: "CZK",
  total: 9000,
  summary: "Rajská, Řízek, Koleno",
} as GuestOrder

const shown = (
  confirmation: Partial<SelfPayOrderConfirmation> | null
): ShownGuestOrder => ({
  order,
  confirmation:
    confirmation === null
      ? null
      : { v: 1, number: 4, total: 9000, covered: 9000, at: 1, ...confirmation },
})

describe("where the guest's order stands", () => {
  test.each([
    [
      "not confirmed yet",
      null,
      "Restaurace vaši objednávku zatím nepotvrdila.",
    ],
    [
      "paid and waiting for the staff",
      {},
      "Objednávka 4 je zaplacená. Čeká na obsluhu.",
    ],
    ["being prepared", { accepted: 2 }, "Objednávka 4 se připravuje."],
    ["served", { accepted: 2, served: 3 }, "Objednávka 4 je vydaná."],
    [
      "rejected, though staff had accepted it",
      { accepted: 2, rejected: 3 },
      "Objednávka 4 byla odmítnuta. Peníze vám vrátí obsluha.",
    ],
  ] as const)("says %s", (_name, confirmation, status) => {
    expect(guestOrderStatus(shown(confirmation), t, "cs")).toBe(status)
  })

  test("keeps telling what is left to pay while the order is being prepared", () => {
    const partlyPaid = shown({ covered: 8000, accepted: 2 })

    expect(guestOrderLeft(partlyPaid)).toBe(1000)
    expect(guestOrderStatus(partlyPaid, t, "cs")).toMatch(
      /^Objednávka 4 se připravuje\. Zbývá zaplatit 10/u
    )
  })

  test("keeps telling what is left to pay once the order is served", () => {
    expect(
      guestOrderStatus(shown({ covered: 8000, served: 3 }), t, "cs")
    ).toMatch(/^Objednávka 4 je vydaná\. Zbývá zaplatit 10/u)
  })

  test("asks for nothing more once the order is rejected", () => {
    expect(guestOrderLeft(shown({ covered: 8000, rejected: 3 }))).toBe(0)
  })
})
