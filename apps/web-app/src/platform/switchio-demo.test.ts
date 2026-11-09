import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

const plugin = vi.hoisted(() => ({
  isInstalled: vi.fn(async () => ({ installed: true })),
  pay: vi.fn(),
}))

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => plugin,
}))

const { createSwitchioTerminalDep } = await import("./switchio.ts")

describe("a demo account and SwitchioPay in Payky (demo-data/0001)", () => {
  it("never launches the terminal for a card payment", async () => {
    const result = await createSwitchioTerminalDep({
      demo: true,
    }).switchioTerminal.pay({
      transactionId: "t1",
      amount: 100,
      tipAmount: 0,
      currencyCode: 203,
    })

    expect(result).toEqual({
      ok: false,
      error: { type: "SwitchioUnavailable", reason: "demo" },
    })
    expect(plugin.pay).not.toHaveBeenCalled()
  })

  it("launches it for any other account", async () => {
    plugin.pay.mockResolvedValueOnce({
      transactionId: "t1",
      resultCode: 0,
      transactionResult: null,
    })

    await createSwitchioTerminalDep({ demo: false }).switchioTerminal.pay({
      transactionId: "t1",
      amount: 100,
      tipAmount: 0,
      currencyCode: 203,
    })

    expect(plugin.pay).toHaveBeenCalledTimes(1)
  })

  it("is told by useAppRun whether the active account is a demo", () => {
    const useAppRun = readFileSync(
      new URL("../hooks/use-app-run.ts", import.meta.url),
      "utf8"
    )
    expect(useAppRun).toContain("const demo = account.demo !== null")
    expect(useAppRun).toContain("createSwitchioTerminalDep({ demo })")
  })
})
