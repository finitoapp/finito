import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A fake `PaykySwitchio` module that behaves as the Kotlin one does: the
 * result is stored before the launch's promise resolves, and JS clears it.
 */
const native = vi.hoisted(() => {
  const stored = {
    payment: null as unknown,
    closure: null as unknown,
    refund: null as unknown,
  }
  return {
    stored,
    isInstalled: vi.fn(() => true),
    pay: vi.fn(),
    close: vi.fn(),
    reversal: vi.fn(),
    referralRefund: vi.fn(),
    lookupTransaction: vi.fn(),
    peekStoredResult: vi.fn(() => stored.payment),
    acknowledgeResult: vi.fn(() => {
      stored.payment = null
    }),
    peekStoredClosureResult: vi.fn(() => stored.closure),
    acknowledgeClosureResult: vi.fn(() => {
      stored.closure = null
    }),
    peekStoredRefundResult: vi.fn(() => stored.refund),
    acknowledgeRefundResult: vi.fn(() => {
      stored.refund = null
    }),
  }
})

vi.mock("expo", () => ({
  NativeModule: class {},
  requireOptionalNativeModule: () => native,
}))

const {
  createSwitchioClosureDep,
  createSwitchioRefundDep,
  createSwitchioTerminalDep,
  takeRestoredSwitchioClosureResult,
  takeRestoredSwitchioRefundResult,
  takeRestoredSwitchioResult,
} = await import("./switchio.ts")

/** A launch whose result SwitchioPay has returned, but whose promise has not resolved yet. */
const returnedButUnresolved = <T>() => {
  const deferred = Promise.withResolvers<T>()
  return { promise: deferred.promise, resolve: deferred.resolve }
}

const closureResult = {
  resultCode: 0,
  transactionResult: JSON.stringify({
    transactionType: "CLOSE_BATCH",
    responseCode: "OK",
    batchTotals: {
      batchNumber: 7,
      shiftNumber: 1,
      debitsCount: 1,
      debitsAmount: 100,
      creditsCount: 0,
      creditsAmount: 0,
      adjsCount: 0,
      adjsAmount: 0,
    },
  }),
}

beforeEach(() => {
  vi.clearAllMocks()
  native.stored.payment = null
  native.stored.closure = null
  native.stored.refund = null
})

describe("a SwitchioPay result is settled by one path (payment/0008)", () => {
  it("leaves a closure's stored result to its promise while the closure is in flight", async () => {
    const launch = returnedButUnresolved<unknown>()
    native.close.mockReturnValueOnce(launch.promise)

    const closing = createSwitchioClosureDep({
      demo: false,
    }).switchioClosure.close()
    // SwitchioPay has returned: MainActivity stored the result, and the app
    // came back to the foreground before the promise's continuation ran.
    native.stored.closure = closureResult

    expect(takeRestoredSwitchioClosureResult()).toBeNull()
    expect(native.acknowledgeClosureResult).not.toHaveBeenCalled()

    launch.resolve(closureResult)
    await closing

    expect(native.acknowledgeClosureResult).toHaveBeenCalledTimes(1)
    expect(takeRestoredSwitchioClosureResult()).toBeNull()
  })

  it("takes a stored closure result no promise in this runtime is waiting for", () => {
    native.stored.closure = closureResult

    expect(takeRestoredSwitchioClosureResult()).toEqual(closureResult)
    expect(native.acknowledgeClosureResult).toHaveBeenCalledTimes(1)
  })

  it("refuses a second closure while one is on SwitchioPay", async () => {
    const launch = returnedButUnresolved<unknown>()
    native.close.mockReturnValueOnce(launch.promise)
    const { switchioClosure } = createSwitchioClosureDep({ demo: false })

    const first = switchioClosure.close()
    const second = await switchioClosure.close()

    expect(second).toEqual({
      ok: false,
      error: {
        type: "SwitchioResultUnreadable",
        resultCode: null,
        rawResult: null,
      },
    })
    expect(native.close).toHaveBeenCalledTimes(1)
    launch.resolve(closureResult)
    await first
  })

  it("leaves a payment's stored result to its promise while the payment is in flight", async () => {
    const launch = returnedButUnresolved<unknown>()
    native.pay.mockReturnValueOnce(launch.promise)
    const payResult = {
      transactionId: "t1",
      resultCode: 0,
      transactionResult: null,
    }

    const paying = createSwitchioTerminalDep({
      demo: false,
    }).switchioTerminal.pay({
      transactionId: "t1",
      amount: 100,
      tipAmount: 0,
      currencyCode: 203,
    })
    native.stored.payment = payResult

    expect(takeRestoredSwitchioResult()).toBeNull()
    expect(native.acknowledgeResult).not.toHaveBeenCalled()

    launch.resolve(payResult)
    await paying

    expect(native.acknowledgeResult).toHaveBeenCalledExactlyOnceWith("t1")
  })

  it("leaves a refund's stored result to its promise while the refund is in flight", async () => {
    const launch = returnedButUnresolved<unknown>()
    native.reversal.mockReturnValueOnce(launch.promise)
    const refundResult = {
      transactionId: "r1",
      resultCode: 0,
      transactionResult: null,
    }

    const reversing = createSwitchioRefundDep({
      demo: false,
    }).switchioRefund.reverse({
      transactionId: "r1",
      originalTransactionId: "t1",
    })
    native.stored.refund = refundResult

    expect(takeRestoredSwitchioRefundResult()).toBeNull()
    expect(native.acknowledgeRefundResult).not.toHaveBeenCalled()

    launch.resolve(refundResult)
    await reversing

    expect(native.acknowledgeRefundResult).toHaveBeenCalledExactlyOnceWith("r1")
  })
})
