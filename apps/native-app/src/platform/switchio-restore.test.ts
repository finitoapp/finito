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

const owner = { activeAccountId: "a1", deviceAccountIds: new Set(["a1"]) }

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
      accountId: "a1",
    }).switchioClosure.close()
    // SwitchioPay has returned: MainActivity stored the result, and the app
    // came back to the foreground before the promise's continuation ran.
    native.stored.closure = closureResult

    expect(takeRestoredSwitchioClosureResult(owner)).toBeNull()
    expect(native.acknowledgeClosureResult).not.toHaveBeenCalled()

    launch.resolve(closureResult)
    await closing

    expect(native.acknowledgeClosureResult).toHaveBeenCalledTimes(1)
    expect(takeRestoredSwitchioClosureResult(owner)).toBeNull()
  })

  it("takes a stored closure result no promise in this runtime is waiting for", () => {
    native.stored.closure = closureResult

    expect(takeRestoredSwitchioClosureResult(owner)).toEqual(closureResult)
    expect(native.acknowledgeClosureResult).toHaveBeenCalledTimes(1)
  })

  it("refuses a second closure while one is on SwitchioPay", async () => {
    const launch = returnedButUnresolved<unknown>()
    native.close.mockReturnValueOnce(launch.promise)
    const { switchioClosure } = createSwitchioClosureDep({
      demo: false,
      accountId: "a1",
    })

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
      accountId: "a1",
    }).switchioTerminal.pay({
      transactionId: "t1",
      amount: 100,
      tipAmount: 0,
      currencyCode: 203,
    })
    native.stored.payment = payResult

    expect(takeRestoredSwitchioResult(owner)).toBeNull()
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
      accountId: "a1",
    }).switchioRefund.reverse({
      transactionId: "r1",
      originalTransactionId: "t1",
    })
    native.stored.refund = refundResult

    expect(takeRestoredSwitchioRefundResult(owner)).toBeNull()
    expect(native.acknowledgeRefundResult).not.toHaveBeenCalled()

    launch.resolve(refundResult)
    await reversing

    expect(native.acknowledgeRefundResult).toHaveBeenCalledExactlyOnceWith("r1")
  })
})

describe("a stored SwitchioPay result belongs to the account it was launched in", () => {
  const twoAccounts = {
    activeAccountId: "b",
    deviceAccountIds: new Set(["a", "b"]),
  }

  it("stores the account with each launch", async () => {
    native.close.mockResolvedValueOnce(closureResult)
    native.pay.mockResolvedValueOnce({
      transactionId: "t1",
      resultCode: 0,
      transactionResult: null,
    })
    native.reversal.mockResolvedValueOnce({
      transactionId: "r1",
      resultCode: 0,
      transactionResult: null,
    })

    await createSwitchioClosureDep({
      demo: false,
      accountId: "a",
    }).switchioClosure.close()
    await createSwitchioTerminalDep({
      demo: false,
      accountId: "a",
    }).switchioTerminal.pay({
      transactionId: "t1",
      amount: 100,
      tipAmount: 0,
      currencyCode: 203,
    })
    await createSwitchioRefundDep({
      demo: false,
      accountId: "a",
    }).switchioRefund.reverse({
      transactionId: "r1",
      originalTransactionId: "t1",
    })

    expect(native.close).toHaveBeenCalledWith("a")
    expect(native.pay.mock.calls[0]?.at(-1)).toBe("a")
    expect(native.reversal.mock.calls[0]?.at(-1)).toBe("a")
  })

  it("leaves a closure of another account on this device for that account", () => {
    native.stored.closure = { ...closureResult, accountId: "a" }

    expect(takeRestoredSwitchioClosureResult(twoAccounts)).toBeNull()
    expect(native.acknowledgeClosureResult).not.toHaveBeenCalled()

    expect(
      takeRestoredSwitchioClosureResult({
        ...twoAccounts,
        activeAccountId: "a",
      })
    ).toEqual(closureResult)
    expect(native.acknowledgeClosureResult).toHaveBeenCalledTimes(1)
  })

  it("clears a result whose account is gone from this device as unusable", () => {
    native.stored.closure = { ...closureResult, accountId: "gone" }
    native.stored.payment = {
      transactionId: "t1",
      resultCode: 0,
      transactionResult: null,
      accountId: "gone",
    }
    native.stored.refund = {
      transactionId: "r1",
      resultCode: 0,
      transactionResult: null,
      accountId: "gone",
    }

    expect(takeRestoredSwitchioClosureResult(twoAccounts)).toBe("unusable")
    expect(takeRestoredSwitchioResult(twoAccounts)).toBe("unusable")
    expect(takeRestoredSwitchioRefundResult(twoAccounts)).toBe("unusable")
    expect(native.acknowledgeClosureResult).toHaveBeenCalledTimes(1)
    expect(native.acknowledgeResult).toHaveBeenCalledExactlyOnceWith("t1")
    expect(native.acknowledgeRefundResult).toHaveBeenCalledExactlyOnceWith("r1")
  })

  it("leaves a payment and a refund of another account on this device for that account", () => {
    native.stored.payment = {
      transactionId: "t1",
      resultCode: 0,
      transactionResult: null,
      accountId: "a",
    }
    native.stored.refund = {
      transactionId: "r1",
      resultCode: 0,
      transactionResult: null,
      accountId: "a",
    }

    expect(takeRestoredSwitchioResult(twoAccounts)).toBeNull()
    expect(takeRestoredSwitchioRefundResult(twoAccounts)).toBeNull()
    expect(native.acknowledgeResult).not.toHaveBeenCalled()
    expect(native.acknowledgeRefundResult).not.toHaveBeenCalled()
  })

  it("takes a result stored before the account was kept in the active account", () => {
    native.stored.closure = closureResult

    expect(takeRestoredSwitchioClosureResult(twoAccounts)).toEqual(
      closureResult
    )
  })
})
