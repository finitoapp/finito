import { describe, expect, it, vi } from "vitest"

const native = vi.hoisted(() => ({
  isInstalled: vi.fn(() => true),
  pay: vi.fn(),
  close: vi.fn(),
  peekStoredResult: vi.fn(() => null),
  acknowledgeResult: vi.fn(),
  peekStoredClosureResult: vi.fn(() => null),
  acknowledgeClosureResult: vi.fn(),
}))

vi.mock("expo", () => ({
  NativeModule: class {},
  requireOptionalNativeModule: () => native,
}))

const { createSwitchioClosureDep, createSwitchioTerminalDep } = await import(
  "./switchio.ts"
)

describe("a demo account and SwitchioPay (demo-data/0001)", () => {
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
    expect(native.pay).not.toHaveBeenCalled()
  })

  it("never closes the terminal's batch", async () => {
    const result = await createSwitchioClosureDep({
      demo: true,
    }).switchioClosure.close()

    expect(result).toEqual({
      ok: false,
      error: { type: "SwitchioUnavailable", reason: "demo" },
    })
    expect(native.close).not.toHaveBeenCalled()
  })

  it("launches the terminal for an account that is not a demo", async () => {
    native.close.mockResolvedValueOnce({
      resultCode: -1,
      transactionResult: JSON.stringify({
        responseCode: "OK",
        batchTotals: {
          shiftNumber: 1,
          batchNumber: 2,
          debitsCount: 0,
          debitsAmount: 0,
          creditsCount: 0,
          creditsAmount: 0,
          adjsCount: 0,
          adjsAmount: 0,
        },
      }),
    })

    const result = await createSwitchioClosureDep({
      demo: false,
    }).switchioClosure.close()

    expect(result.ok).toBe(true)
    expect(native.close).toHaveBeenCalledOnce()
  })
})
