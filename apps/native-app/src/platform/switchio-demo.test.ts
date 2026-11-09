import { describe, expect, it, vi } from "vitest"

const native = vi.hoisted(() => ({
  isInstalled: vi.fn(() => true),
  pay: vi.fn(),
  close: vi.fn(),
  peekStoredResult: vi.fn(() => null),
  acknowledgeResult: vi.fn(),
  peekStoredClosureResult: vi.fn(() => null),
  acknowledgeClosureResult: vi.fn(),
  reversal: vi.fn(),
  referralRefund: vi.fn(),
  lookupTransaction: vi.fn(),
  peekStoredRefundResult: vi.fn(() => null),
  acknowledgeRefundResult: vi.fn(),
}))

vi.mock("expo", () => ({
  NativeModule: class {},
  requireOptionalNativeModule: () => native,
}))

const {
  createSwitchioClosureDep,
  createSwitchioRefundDep,
  createSwitchioTerminalDep,
} = await import("./switchio.ts")

describe("a demo account and SwitchioPay (demo-data/0001)", () => {
  it("never launches the terminal for a card payment", async () => {
    const result = await createSwitchioTerminalDep({
      demo: true,
      accountId: "a1",
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
      accountId: "a1",
    }).switchioClosure.close()

    expect(result).toEqual({
      ok: false,
      error: { type: "SwitchioUnavailable", reason: "demo" },
    })
    expect(native.close).not.toHaveBeenCalled()
  })

  it("never takes a payment back, refunds to the card nor asks the terminal", async () => {
    const { switchioRefund } = createSwitchioRefundDep({
      demo: true,
      accountId: "a1",
    })

    await expect(
      switchioRefund.referralRefund({
        transactionId: "t1",
        amount: 100,
        currencyCode: 203,
        refundId: "123456789012345678",
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "SwitchioUnavailable", reason: "demo" },
    })
    await expect(
      switchioRefund.reverse({
        transactionId: "t1",
        originalTransactionId: "payment-1",
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "SwitchioUnavailable", reason: "demo" },
    })
    await expect(switchioRefund.lookup("t1")).resolves.toEqual({
      type: "unknown",
    })
    expect(native.reversal).not.toHaveBeenCalled()
    expect(native.referralRefund).not.toHaveBeenCalled()
    expect(native.lookupTransaction).not.toHaveBeenCalled()
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
      accountId: "a1",
    }).switchioClosure.close()

    expect(result.ok).toBe(true)
    expect(native.close).toHaveBeenCalledOnce()
  })
})
