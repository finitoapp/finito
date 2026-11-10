import { describe, expect, test } from "vitest"

import type { MonetaTransaction } from "../../integrations/moneta/moneta-client.ts"
import { Integer } from "../shared/schema.ts"
import {
  estimateMonetaDailyCalls,
  isIncomingMonetaTransaction,
  isMonetaFastWatchActive,
  MONETA_DAILY_CALL_LIMIT,
  MONETA_FAST_WATCH_INTERVAL_MS,
  MONETA_FAST_WATCH_WINDOW_MS,
  maskMonetaToken,
  monetaBankDay,
  monetaPluginCheckIntervalSeconds,
} from "./moneta-plugin-utils.ts"

const transaction: MonetaTransaction = {
  id: "E-1",
  status: "booked",
  isReversal: false,
  direction: "incoming",
  amountMinor: Integer(100),
  currency: "CZK",
  occurredOn: null,
  variableSymbol: null,
  constantSymbol: null,
  specificSymbol: null,
  note: null,
  recipientMessage: null,
  raw: null,
}

describe("isIncomingMonetaTransaction", () => {
  test("is a booked incoming transfer in the account's currency", () => {
    expect(isIncomingMonetaTransaction(transaction, "CZK")).toBe(true)
  })

  test("is not anything else", () => {
    for (const other of [
      { ...transaction, status: "pending" as const },
      { ...transaction, status: "other" as const },
      { ...transaction, isReversal: true },
      { ...transaction, direction: "outgoing" as const },
      { ...transaction, id: null },
      { ...transaction, amountMinor: Integer(0) },
    ]) {
      expect(isIncomingMonetaTransaction(other, "CZK")).toBe(false)
    }
    expect(isIncomingMonetaTransaction(transaction, "EUR")).toBe(false)
  })
})

describe("isMonetaFastWatchActive", () => {
  const createdAt = new Date("2026-05-26T10:00:00.000Z")
  const active = {
    payable: true,
    isNativeRuntime: true,
    hasActivePlugin: true,
    isStopped: false,
    createdAt,
    now: new Date(createdAt.getTime() + 60_000),
  }

  test("asks the bank while a payable payment waits on a native device", () => {
    expect(isMonetaFastWatchActive(active)).toBe(true)
  })

  test("stops outside the window, on the web, without a plugin, or once the bank refused", () => {
    expect(
      isMonetaFastWatchActive({
        ...active,
        now: new Date(createdAt.getTime() + MONETA_FAST_WATCH_WINDOW_MS),
      })
    ).toBe(false)
    expect(isMonetaFastWatchActive({ ...active, payable: false })).toBe(false)
    expect(isMonetaFastWatchActive({ ...active, isNativeRuntime: false })).toBe(
      false
    )
    expect(isMonetaFastWatchActive({ ...active, hasActivePlugin: false })).toBe(
      false
    )
    expect(isMonetaFastWatchActive({ ...active, isStopped: true })).toBe(false)
  })
})

describe("the MONETA call budget", () => {
  test("three devices in the background leave room for 25 full payment waits", () => {
    const background = 3 * estimateMonetaDailyCalls(300)
    const fullWait = MONETA_FAST_WATCH_WINDOW_MS / MONETA_FAST_WATCH_INTERVAL_MS

    expect(background).toBe(864)
    expect(fullWait).toBe(150)
    expect(background + 25 * fullWait).toBeLessThan(MONETA_DAILY_CALL_LIMIT)
  })
})

describe("monetaPluginCheckIntervalSeconds", () => {
  test("keeps a minute between background syncs whatever the row holds", () => {
    expect(monetaPluginCheckIntervalSeconds(1)).toBe(60)
    expect(monetaPluginCheckIntervalSeconds(60)).toBe(60)
    expect(monetaPluginCheckIntervalSeconds(300)).toBe(300)
  })
})

describe("monetaBankDay", () => {
  test("counts days in the bank's time zone, whatever the device's", () => {
    // Prague is UTC+1 in winter and UTC+2 in summer.
    expect(monetaBankDay(new Date("2026-10-30T22:59:59Z"))).toBe("2026-10-30")
    expect(monetaBankDay(new Date("2026-10-30T23:00:00Z"))).toBe("2026-10-31")
    expect(monetaBankDay(new Date("2026-07-01T21:59:59Z"))).toBe("2026-07-01")
    expect(monetaBankDay(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02")
  })
})

describe("maskMonetaToken", () => {
  test("shows only the last four characters", () => {
    expect(maskMonetaToken("secret-token-1234")).toBe("********1234")
    expect(maskMonetaToken("")).toBe("********")
  })
})
